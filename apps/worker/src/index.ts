import type { NetworkId } from "@tegata/config"
import { bitnobClient } from "@tegata/core/bitnob"
import { Operator } from "@tegata/core/near"
import { NOAH_TEST_USDC_MINT, noahClient } from "@tegata/core/noah"
import { sendToken } from "@tegata/core/solana"
import { transakClient } from "@tegata/core/transak"
import { createDb, schema } from "@tegata/db"
import { migrateDb } from "@tegata/db/migrate"
import {
  type EmailEvent,
  renderInvoicePdf,
  renderPayslipPdf,
  renderStatementPdf,
  resendMailer,
} from "@tegata/documents"
import {
  allowLocalWebhooks,
  emailConfigured,
  loadDotEnv,
  operatorKeys,
  serverEnv,
} from "@tegata/env"
import { enqueue, QUEUES, startBoss } from "@tegata/jobs"
import {
  accountsNotReady,
  autopilotsToRegister,
  bankPayoutsToMove,
  cardMovesToFund,
  cardPaymentsToPoll,
  claimEmails,
  createTreasuryOnChain,
  creditBankDeposits,
  deliver,
  destinationsToRegister,
  fundCardMove,
  hopBankPayout,
  invoiceDocuments,
  invoiceToken,
  logInvoiceEvent,
  markEmail,
  markInvited,
  monthStatement,
  oneClickToPoll,
  ownerAddress,
  paymentsToVerify,
  payoutsToPoll,
  payslipDocument,
  pendingDeliveries,
  pollBankPayout,
  pollCardPayment,
  pollOneClickPayment,
  pollPayout,
  processMoveOut,
  processRelay,
  queueAccountEmail,
  queueAutopilotOn,
  queueBankDepositEmail,
  queueBankPayoutEmail,
  queuedTestDollars,
  queueInviteEmail,
  queueInvoiceEmail,
  queuePayinRefundedEmail,
  queuePaymentEmails,
  queuePayoutEmail,
  queuePayrollDue,
  queueReferralEmails,
  queueReferralsQualified,
  queueRunEmails,
  queueSendEmails,
  queueStatements,
  queueWebhookFailing,
  registerDestination,
  registerForAutopilot,
  registerPayoutAddress,
  registerRunAddresses,
  remindersDue,
  reminderTarget,
  reminderTimes,
  removeCard,
  returnFailedBankPayout,
  runAutopilots,
  runDueSchedules,
  runRelaysToSettle,
  sendTestDollars,
  settleAutopilotAction,
  settleAutopilotRelay,
  settleBankRelay,
  settleCardRelay,
  settlePayment,
  settlePayoutRelay,
  settlePayrollPayout,
  settleRefund,
  settleRelayedPayment,
  settleRunRelay,
  settleTreasuryRelay,
  setupAccount,
  sweepReferrals,
  syncTreasuryRuns,
  topUpTreasuries,
  topUpTreasury,
  treasuriesToCreate,
  USDC_DECIMALS,
  unfinishedRelays,
  WEBHOOK_BACKOFF_MS,
  wanted,
} from "@tegata/services"
import { and, eq } from "drizzle-orm"

loadDotEnv(new URL("../../../.env", import.meta.url).pathname)
const env = serverEnv()

const STOP_TIMEOUT_MS = 10_000
const DB_CLOSE_SECONDS = 5

const { db, sql } = createDb(env.DATABASE_URL)
await migrateDb(db)
console.log("[worker] database up to date")
const boss = await startBoss(env.DATABASE_URL)

/** The worker is the only process that holds operator keys. */
const operators = new Map<NetworkId, Operator>([
  ["testnet", new Operator("testnet", operatorKeys("testnet", env))],
])
if (env.OPERATOR_KEYS_MAINNET?.length) {
  operators.set("mainnet", new Operator("mainnet", env.OPERATOR_KEYS_MAINNET))
}

/**
 * Where emails load their pictures and point their links: the public site. A mail client can't reach localhost, so a
 * worker running locally still uses the live site's PNGs and pages.
 */
const emailBase = /localhost|127\.0\.0\.1/.test(env.APP_URL)
  ? "https://tegata.xyz"
  : env.APP_URL.replace(/\/$/, "")

/** Email goes out only when Resend and a verified sender are set; otherwise invoices are shared by link. */
const mailer =
  emailConfigured(env) && env.RESEND_API_KEY && env.EMAIL_FROM
    ? resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM, emailBase)
    : null

/** Queue every webhook delivery that is new or due for its next try (one job per delivery attempt). */
async function queueDeliveries() {
  const now = Date.now()
  for (const d of await pendingDeliveries(db)) {
    const wait = d.attempts === 0 ? 0 : (WEBHOOK_BACKOFF_MS[d.attempts - 1] ?? 0)
    if (d.updatedAt.getTime() + wait > now) continue
    await enqueue(boss, "webhookDeliver", { deliveryId: d.id }, `${d.id}:${d.attempts}`)
  }
}

await boss.work(QUEUES.relaySend.name, async ([job]) => {
  if (!job) return
  const { relayId } = QUEUES.relaySend.payload.parse(job.data)
  const pending = await unfinishedRelays(db)
  const network = pending.find((relay) => relay.id === relayId)?.network
  const operator = network ? operators.get(network) : undefined
  if (!operator) return
  // A payout: its 1Click deposit address must hold a USDC registration before the transfer lands (operator-paid).
  await registerPayoutAddress(db, operator, relayId)
  // A payroll batch with rows to another chain: each row's NEAR Intents deposit address needs the same.
  await registerRunAddresses(db, operator, relayId)
  // A treasury proposal or vote: the treasury pays its own storage, so make sure it has NEAR before it's relayed.
  const [ahead] = await db
    .select({ purpose: schema.relays.purpose, receiverId: schema.relays.receiverId })
    .from(schema.relays)
    .where(eq(schema.relays.id, relayId))
  if (ahead?.purpose.startsWith("treasury-propose:") || ahead?.purpose.startsWith("treasury-vote:"))
    await topUpTreasury(operator, ahead.receiverId)
  const relay = await processRelay(db, operator, relayId)
  if (relay) console.log(`[relay] ${relay.purpose} ${relay.status} ${relay.txHash ?? ""}`)
  // A payment from a Tegata balance settles as soon as its relay lands.
  if (relay?.purpose.startsWith("pay:")) {
    const settled = await settleRelayedPayment(db, relay.id, operator.accountId)
    console.log(`[payment] ${relay.purpose} ${settled}`)
    const paymentId = relay.purpose.slice("pay:".length)
    if (settled === "succeeded") await queuePaymentEmails(db, paymentId)
  }
  // Autopilot: once the plan's relay lands, read its id from the contract; turning it off ends it.
  if (relay?.purpose.startsWith("autopilot:")) {
    const on = await settleAutopilotRelay(db, relay.id)
    await settleAutopilotAction(db, relay.id)
    if (on === "on") await queueAutopilotOn(db, relay.purpose.split(":")[1] ?? "")
    console.log(`[autopilot] ${relay.purpose} ${relay.status} ${on}`)
  }
  // A refund: once it lands, it counts against the payment.
  if (relay?.purpose.startsWith("refund:")) {
    const payment = await settleRefund(db, relay.id)
    if (payment) console.log(`[refund] ${payment.id} refunded ${payment.refunded}`)
  }
  // A one-off send on NEAR: the business gets its copy; a Tegata account on the other end hears it arrived.
  if (relay?.purpose.startsWith("send:") && relay.status === "success")
    await queueSendEmails(db, relay.id)
  // A settled payment or refund may have raised webhook events: send them now rather than at the next sweep.
  if (relay?.purpose.startsWith("pay:") || relay?.purpose.startsWith("refund:"))
    await queueDeliveries()
  // A payout: once its transfer lands, tell 1Click and follow it to delivery.
  if (relay?.purpose.startsWith("payout:")) {
    const payoutId = await settlePayoutRelay(db, relay.id, operator.accountId, env.ONECLICK_API_KEY)
    if (payoutId) await enqueue(boss, "payoutPoll", { payoutId }, `payout:${payoutId}`)
  }
  // A withdrawal to a bank: once the USDC reached the operator on NEAR, hand it to Noah.
  if (relay?.purpose.startsWith("bank:")) {
    const payoutId = await settleBankRelay(db, relay.id, operator.accountId)
    if (payoutId) await enqueue(boss, "bankHop", { payoutId }, `bank-hop:${payoutId}`)
  }
  // A card fill: once the USDC reached the card reserve, the issuer makes or raises the card.
  if (relay?.purpose.startsWith("card:")) {
    const moveId = await settleCardRelay(db, relay.id, operator.accountId)
    if (moveId) await enqueue(boss, "cardFund", { moveId }, `card-fund:${moveId}`)
  }
  // The team treasury: the seal makes it ready; a vote that reaches k pays the run from the treasury's USDC events.
  if (relay?.purpose.startsWith("treasury-")) {
    const settled = await settleTreasuryRelay(db, relay.id, operator.accountId)
    console.log(`[treasury] ${relay.purpose} ${settled}`)
    if (settled === "paid" || settled === "failed")
      await queueRunEmails(db, relay.purpose.split(":")[1] ?? "")
  }
  // A payroll batch: its rows are paid only once the USDC events are read from NEAR.
  if (relay?.purpose.startsWith("run:")) {
    const settled = await settleRunRelay(db, relay.id, operator.accountId, env.ONECLICK_API_KEY)
    console.log(`[payroll] ${relay.purpose} ${settled}`)
    // Paid, or a batch failed: payslips go to everyone who was paid, and the business hears how the run went.
    if (settled === "paid" || settled === "failed")
      await queueRunEmails(db, relay.purpose.split(":")[1] ?? "")
  }
})

await boss.work(QUEUES.destinationRegister.name, async ([job]) => {
  if (!job) return
  const { destinationId } = QUEUES.destinationRegister.payload.parse(job.data)
  const row = (await destinationsToRegister(db)).find((d) => d.id === destinationId)
  const operator = row ? operators.get(row.network) : undefined
  if (!row || !operator) return
  const ready = await registerDestination(db, operator, destinationId)
  console.log(
    `[payroll] ${ready?.accountId} ${ready?.readyAt ? "ready" : (ready?.error ?? "waiting")}`,
  )
})

await boss.work(QUEUES.accountSetup.name, async ([job]) => {
  if (!job) return
  const { accountRowId } = QUEUES.accountSetup.payload.parse(job.data)
  const pending = await accountsNotReady(db)
  const row = pending.find((account) => account.id === accountRowId)
  const operator = row ? operators.get(row.network) : undefined
  // No operator for this network yet (Live is off): leave the row for when it is switched on.
  if (!row || !operator) return
  const ready = await setupAccount(db, operator, accountRowId)
  if (ready) console.log(`[account] ${ready.accountId} ready`)
  if (ready?.readyAt) await queueAccountEmail(db, accountRowId)
})

await boss.work(QUEUES.paymentVerify.name, async ([job]) => {
  if (!job) return
  const { paymentId } = QUEUES.paymentVerify.payload.parse(job.data)
  const [payment] = (await paymentsToVerify(db)).filter((p) => p.id === paymentId)
  if (!payment?.txHash || !payment.payer) return
  const settled = await settlePayment(db, payment.id, payment.txHash, payment.payer)
  console.log(`[payment] ${payment.id} ${settled}`)
  if (settled === "succeeded") await queueDeliveries()
  if (settled === "succeeded") await queuePaymentEmails(db, payment.id)
  // Not final yet: throw so the queue tries again with backoff.
  if (settled === "pending") throw new Error("Transaction not final yet")
})

await boss.work(QUEUES.testDollars.name, async ([job]) => {
  if (!job) return
  const { grantId } = QUEUES.testDollars.payload.parse(job.data)
  const operator = operators.get("testnet")
  if (!operator) return
  const status = await sendTestDollars(db, operator, grantId)
  console.log(`[test-dollars] ${grantId} ${status}`)
})

/** Invoice emails: queued in the outbox at their time; the drain attaches the PDF and logs them on the timeline. */
await boss.work(QUEUES.invoiceEmail.name, async ([job]) => {
  if (!job) return
  const { invoiceId, kind, offset, manualDay } = QUEUES.invoiceEmail.payload.parse(job.data)
  const sent = await invoiceToken(db, invoiceId)
  if (!sent) return
  if (kind === "reminder" && !(await reminderTarget(db, invoiceId, { manual: Boolean(manualDay) })))
    return
  await queueInvoiceEmail(db, invoiceId, kind === "invoice" ? "invoice.sent" : "invoice.reminder", {
    offset: offset ?? 0,
    manualDay,
  })
})

/** Hourly: queue every reminder step due in the next hour, so invoices sent while email was off still get them. */
await boss.schedule(QUEUES.invoiceReminderSweep.name, "5 * * * *", {})
await boss.work(QUEUES.invoiceReminderSweep.name, async () => {
  if (!mailer) return
  const due = await remindersDue(db)
  for (const step of due)
    await enqueue(
      boss,
      "invoiceEmail",
      { invoiceId: step.invoiceId, kind: "reminder", offset: step.offset },
      `${step.invoiceId}:remind:${step.offset}`,
      { startAfter: step.at },
    )
  if (due.length) console.log(`[reminders] ${due.length} queued for the next hour`)
})

await boss.work(QUEUES.autopilotRegister.name, async ([job]) => {
  if (!job) return
  const { autopilotId } = QUEUES.autopilotRegister.payload.parse(job.data)
  const row = (await autopilotsToRegister(db)).find((a) => a.id === autopilotId)
  const operator = row ? operators.get(row.network) : undefined
  if (!row || !operator) return
  const ready = await registerForAutopilot(db, operator, autopilotId)
  console.log(`[autopilot] ${autopilotId} ${ready?.status ?? "gone"}`)
})

await boss.work(QUEUES.treasuryOpen.name, async ([job]) => {
  if (!job) return
  const { treasuryId } = QUEUES.treasuryOpen.payload.parse(job.data)
  const row = (await treasuriesToCreate(db)).find((t) => t.id === treasuryId)
  const operator = row ? operators.get(row.network) : undefined
  if (!row || !operator) return
  const made = await createTreasuryOnChain(db, operator, treasuryId)
  console.log(`[treasury] ${row.accountId} ${made?.status ?? "gone"} ${made?.error ?? ""}`)
})

/** Every minute: treasury payrolls follow their proposals on NEAR, and every ready treasury keeps NEAR for storage. */
await boss.schedule(QUEUES.treasuryKeeper.name, "* * * * *", {})
await boss.work(QUEUES.treasuryKeeper.name, async () => {
  for (const operator of operators.values()) {
    const synced = await syncTreasuryRuns(db, operator.network, operator.accountId)
    for (const run of synced) {
      if (run.state !== "pending") console.log(`[treasury] run ${run.id} ${run.state}`)
      if (run.state === "paid" || run.state === "failed") await queueRunEmails(db, run.id)
    }
    await topUpTreasuries(db, operator)
  }
})

/** The keeper: every minute, pay the autopilot plans whose payday has come (anyone may call `run`; we do). */
const KEEPER_CRON = "* * * * *"
await boss.schedule(QUEUES.autopilotKeeper.name, KEEPER_CRON, {})
await boss.work(QUEUES.autopilotKeeper.name, async () => {
  for (const operator of operators.values()) {
    const ran = await runAutopilots(db, operator)
    if (ran.length) console.log(`[autopilot] ${operator.network}: ran ${ran.join(", ")}`)
  }
})

await boss.work(QUEUES.webhookDeliver.name, async ([job]) => {
  if (!job) return
  const { deliveryId } = QUEUES.webhookDeliver.payload.parse(job.data)
  const result = await deliver(db, deliveryId, allowLocalWebhooks(env))
  if (result?.status === "failed") await queueWebhookFailing(db, deliveryId)
  if (result)
    console.log(
      `[webhook] ${deliveryId} ${result.status}${result.retryInMs ? ` (next in ${result.retryInMs / 1000}s)` : ""}`,
    )
})
const WEBHOOK_CRON = "* * * * *"
/** A Live pay-in moves through 1Click in seconds to minutes: read it every few seconds while it's open. */
const ONECLICK_POLL_MS = 5_000
await boss.work(QUEUES.oneclickPoll.name, async ([job]) => {
  if (!job) return
  const { paymentId } = QUEUES.oneclickPoll.payload.parse(job.data)
  const result = await pollOneClickPayment(db, paymentId, env.ONECLICK_API_KEY)
  if (result === "pending") {
    await enqueue(boss, "oneclickPoll", { paymentId }, `oneclick:${paymentId}`, {
      startAfter: new Date(Date.now() + ONECLICK_POLL_MS),
    })
    return
  }
  console.log(`[oneclick] ${paymentId} ${result}`)
  if (result === "succeeded") {
    await queueDeliveries()
    await queuePaymentEmails(db, paymentId)
  }
  if (result === "refunded") await queuePayinRefundedEmail(db, paymentId)
})
await boss.work(QUEUES.payoutPoll.name, async ([job]) => {
  if (!job) return
  const { payoutId } = QUEUES.payoutPoll.payload.parse(job.data)
  const result = await pollPayout(db, payoutId, env.ONECLICK_API_KEY)
  if (result === "pending") {
    await enqueue(boss, "payoutPoll", { payoutId }, `payout:${payoutId}`, {
      startAfter: new Date(Date.now() + ONECLICK_POLL_MS),
    })
    return
  }
  console.log(`[payout] ${payoutId} ${result}`)
  await queuePayoutEmail(db, payoutId)
  // A payroll row to another chain is paid only now that NEAR Intents delivered it (or failed, if it came back).
  const payroll = await settlePayrollPayout(db, payoutId)
  if (payroll && (payroll.settled === "paid" || payroll.settled === "failed"))
    await queueRunEmails(db, payroll.runId)
})
await boss.schedule(QUEUES.payoutSweep.name, "* * * * *", {})
await boss.work(QUEUES.payoutSweep.name, async () => {
  for (const open of await payoutsToPoll(db))
    await enqueue(boss, "payoutPoll", { payoutId: open.id }, `payout:${open.id}`)
})
await boss.schedule(QUEUES.oneclickSweep.name, "* * * * *", {})
await boss.work(QUEUES.oneclickSweep.name, async () => {
  for (const open of await oneClickToPoll(db)) {
    await enqueue(boss, "oneclickPoll", { paymentId: open.id }, `oneclick:${open.id}`)
  }
})

await boss.schedule(QUEUES.webhookSweep.name, WEBHOOK_CRON, {})
await boss.work(QUEUES.webhookSweep.name, queueDeliveries)

/** Older queue names that still arrive: each now writes to the outbox. */
await boss.work(QUEUES.paymentEmail.name, async ([job]) => {
  if (!job) return
  const { paymentId } = QUEUES.paymentEmail.payload.parse(job.data)
  await queuePaymentEmails(db, paymentId)
})
await boss.work(QUEUES.payrollEmail.name, async ([job]) => {
  if (!job) return
  const { kind, id } = QUEUES.payrollEmail.payload.parse(job.data)
  if (kind === "invite") {
    const schedule = await payrollCadence(id)
    await queueInviteEmail(db, id, { cadence: schedule })
    await markInvited(db, id)
  } else {
    const runId = await runOfRow(id)
    if (runId) await queueRunEmails(db, runId)
  }
})

/** Repeating invoices: every ten minutes, issue and send those that are due. */
const REPEAT_CRON = "*/10 * * * *"
await boss.schedule(QUEUES.invoiceRepeat.name, REPEAT_CRON, {})
await boss.work(QUEUES.invoiceRepeat.name, async () => {
  for (const issued of await runDueSchedules(db)) {
    console.log(`[repeat] issued ${issued.invoiceId}`)
    await enqueue(
      boss,
      "invoiceEmail",
      { invoiceId: issued.invoiceId, kind: "invoice" },
      `${issued.invoiceId}:invoice`,
    )
    const sent = await invoiceToken(db, issued.invoiceId)
    if (!sent?.reminders) continue
    for (const { offset, at } of reminderTimes(sent.dueDate, issued.timezone)) {
      await enqueue(
        boss,
        "invoiceEmail",
        { invoiceId: issued.invoiceId, kind: "reminder", offset },
        `${issued.invoiceId}:remind:${offset}`,
        { startAfter: at },
      )
    }
  }
})

/** Referrals: every five minutes, qualify the open ones and pay those past their hold, on each network. */
const REFERRAL_CRON = "*/5 * * * *"
async function sweepAllReferrals() {
  // Checking runs first inside sweepReferrals; anything that qualified is told after.
  await queueReferralsQualified(db).catch((e) => console.error("[referrals] email", e))
  for (const operator of operators.values()) {
    const { checked, paid } = await sweepReferrals(db, operator)
    for (const referralId of paid) await queueReferralEmails(db, referralId)
    if (paid.length)
      console.log(`[referrals] ${operator.network}: ${checked} checked, ${paid.length} paid`)
  }
}
await boss.schedule(QUEUES.referralSweep.name, REFERRAL_CRON, {})
await boss.work(QUEUES.referralSweep.name, sweepAllReferrals)

// --- bank payouts and bank details (Noah) -------------------------------------------------------------------------

const noah = env.NOAH_API_KEY ? noahClient(env.NOAH_API_KEY) : null
const BANK_POLL_MS = 8_000

/** Tegata's Solana devnet wallet hands Noah's test USDC to Noah (the Sandbox stand-in for NEAR Intents' hop). */
async function hopToNoah({ to, amount }: { to: string; amount: bigint }) {
  if (!env.SOLANA_DEVNET_SECRET)
    throw new Error("Tegata's Solana test wallet isn't set up on this server")
  return sendToken({
    secret: env.SOLANA_DEVNET_SECRET,
    mint: NOAH_TEST_USDC_MINT,
    decimals: USDC_DECIMALS,
    to,
    amount,
  })
}

await boss.work(QUEUES.bankHop.name, async ([job]) => {
  if (!job) return
  const { payoutId } = QUEUES.bankHop.payload.parse(job.data)
  const status = await hopBankPayout(db, payoutId, hopToNoah)
  console.log(`[bank] ${payoutId} ${status}`)
  if (status === "paying") await enqueue(boss, "bankPoll", { payoutId }, `bank-poll:${payoutId}`)
})
await boss.work(QUEUES.bankPoll.name, async ([job]) => {
  if (!job || !noah) return
  const { payoutId } = QUEUES.bankPoll.payload.parse(job.data)
  const result = await pollBankPayout(db, noah, payoutId)
  if (result === "pending") {
    await enqueue(boss, "bankPoll", { payoutId }, `bank-poll:${payoutId}`, {
      startAfter: new Date(Date.now() + BANK_POLL_MS),
    })
    return
  }
  console.log(`[bank] ${payoutId} ${result}`)
  if (result === "failed") {
    const operator = operators.get("testnet")
    if (operator) await returnFailedBankPayout(db, operator, payoutId)
  }
  await queueBankPayoutEmail(db, payoutId)
})
// Pay by card (Transak): follow each order; a completed Sandbox order is delivered by the operator as test USDC.
const transak =
  env.TRANSAK_API_KEY && env.TRANSAK_API_SECRET
    ? transakClient({
        apiKey: env.TRANSAK_API_KEY,
        apiSecret: env.TRANSAK_API_SECRET,
        env: env.TRANSAK_ENV ?? "staging",
      })
    : null
const CARD_POLL_MS = 5_000
await boss.work(QUEUES.cardPayPoll.name, async ([job]) => {
  if (!job || !transak) return
  const { paymentId } = QUEUES.cardPayPoll.payload.parse(job.data)
  const open = (await cardPaymentsToPoll(db)).find((p) => p.id === paymentId)
  if (!open) return
  const result = await pollCardPayment(db, transak, operators.get(open.network) ?? null, paymentId)
  if (result === "pending") {
    await enqueue(boss, "cardPayPoll", { paymentId }, `card-pay:${paymentId}`, {
      startAfter: new Date(Date.now() + CARD_POLL_MS),
    })
    return
  }
  console.log(`[card-pay] ${paymentId} ${result}`)
  if (result === "succeeded") {
    await queueDeliveries()
    await queuePaymentEmails(db, paymentId)
  }
})
await boss.schedule(QUEUES.cardPaySweep.name, "* * * * *", {})
await boss.work(QUEUES.cardPaySweep.name, async () => {
  if (!transak) return
  for (const open of await cardPaymentsToPoll(db))
    await enqueue(boss, "cardPayPoll", { paymentId: open.id }, `card-pay:${open.id}`)
})

// Cards: Bitnob issues or raises a card once its money is in Tegata's card reserve. Purchases arrive by webhook at the
// web app, which must be public (https), so local runs point Bitnob at the live site.
const bitnob =
  env.BITNOB_CLIENT_ID && env.BITNOB_CLIENT_SECRET
    ? bitnobClient(env.BITNOB_CLIENT_ID, env.BITNOB_CLIENT_SECRET)
    : null
const cardWebhook = `${emailBase}/api/webhooks/bitnob`
await boss.work(QUEUES.cardFund.name, async ([job]) => {
  if (!job || !bitnob) return
  const { moveId } = QUEUES.cardFund.payload.parse(job.data)
  const [move] = await cardMovesToFund(db).then((rows) => rows.filter((r) => r.id === moveId))
  if (!move) return
  const network = move.network
  const operator = operators.get(network)
  if (!operator) return
  const result =
    move.direction === "in"
      ? await fundCardMove(db, bitnob, operator, moveId, cardWebhook)
      : await processMoveOut(db, bitnob, operator, moveId)
  console.log(`[card] ${move.direction} ${moveId} ${result}`)
})
await boss.work(QUEUES.cardRemove.name, async ([job]) => {
  if (!job || !bitnob) return
  const { cardId, network } = QUEUES.cardRemove.payload.parse(job.data)
  const operator = operators.get(network)
  if (!operator) return
  await removeCard(db, bitnob, operator, cardId)
  console.log(`[card] removed ${cardId}`)
})
await boss.schedule(QUEUES.cardSweep.name, "* * * * *", {})
await boss.work(QUEUES.cardSweep.name, async () => {
  if (!bitnob) return
  for (const move of await cardMovesToFund(db))
    await enqueue(boss, "cardFund", { moveId: move.id }, `card-fund:${move.id}`)
})
await boss.schedule(QUEUES.bankSweep.name, "* * * * *", {})
await boss.work(QUEUES.bankSweep.name, async () => {
  for (const moving of await bankPayoutsToMove(db)) {
    if (moving.status === "converting")
      await enqueue(boss, "bankHop", { payoutId: moving.id }, `bank-hop:${moving.id}`)
    else await enqueue(boss, "bankPoll", { payoutId: moving.id }, `bank-poll:${moving.id}`)
  }
  const operator = operators.get("testnet")
  if (noah && operator && env.SOLANA_DEVNET_ADDRESS) {
    const credited = await creditBankDeposits(db, noah, operator, env.SOLANA_DEVNET_ADDRESS)
    for (const depositId of credited) await queueBankDepositEmail(db, depositId)
    if (credited.length) console.log(`[bank] credited ${credited.length} deposit(s)`)
  }
})

// --- email: the outbox drain, and the daily and monthly emails ------------------------------------------------------

const EMAIL_DRAIN_MS = 3_000
/** Something queued while email was off (or stuck a day) is stale news: skip it rather than send it late. */
const EMAIL_MAX_AGE_MS = 24 * 3_600_000
let draining = false

/** The PDF an email carries: an invoice when it goes out, the month's statement. */
async function attachmentsFor(event: EmailEvent, email: { workspaceId: string | null }) {
  if (event.kind === "invoice.sent" && event.data.invoiceId) {
    const sent = await invoiceToken(db, event.data.invoiceId)
    const docs = sent ? await invoiceDocuments(db, sent.token, env.APP_URL) : undefined
    if (docs)
      return [
        { filename: `${docs.document.number}.pdf`, content: await renderInvoicePdf(docs.document) },
      ]
  }
  if (event.kind === "payroll.paid" && event.data.rowId) {
    const doc = await payslipDocument(db, event.data.rowId, env.APP_URL)
    if (doc)
      return [
        {
          filename: `${doc.kind === "receipt" ? "Payment-receipt" : "Payslip"}-${doc.payDate.slice(0, 7)}-${doc.person.name.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`,
          content: await renderPayslipPdf(doc),
        },
      ]
  }
  if (event.kind === "statement.monthly") {
    const doc = email.workspaceId
      ? await monthStatement(
          db,
          email.workspaceId,
          event.data.month,
          event.data.sandbox ? "testnet" : "mainnet",
        )
      : null
    if (doc)
      return [
        {
          filename: `Tegata-statement-${event.data.month}.pdf`,
          content: await renderStatementPdf(doc),
        },
      ]
  }
  return []
}

/** Replies to a customer or payroll email reach the business: its billing email, or else the owner's sign-in email. */
async function replyToFor(workspaceId: string | null) {
  if (!workspaceId) return null
  return ownerAddress(db, workspaceId)
}

async function drainEmails() {
  if (!mailer || draining) return
  draining = true
  try {
    for (const email of await claimEmails(db)) {
      const event = { kind: email.kind, data: email.data } as EmailEvent
      const invoiceId =
        event.kind === "invoice.sent" || event.kind === "invoice.reminder"
          ? event.data.invoiceId
          : undefined
      if (Date.now() - email.createdAt.getTime() > EMAIL_MAX_AGE_MS) {
        await markEmail(db, email.id, { status: "skipped", reason: "Too old to send" })
        continue
      }
      if (
        event.kind === "invoice.reminder" &&
        invoiceId &&
        !(await reminderTarget(db, invoiceId, { manual: Boolean(event.data.manual) }))
      ) {
        await markEmail(db, email.id, {
          status: "skipped",
          reason: "Paid, voided or reminders off before it went out",
        })
        continue
      }
      if (!(await wanted(db, email))) {
        await markEmail(db, email.id, {
          status: "skipped",
          reason: "Turned off in Business → Emails",
        })
        continue
      }
      try {
        const id = await mailer.deliver(event, {
          to: email.to,
          key: email.id,
          replyTo: await replyToFor(email.workspaceId),
          attachments: await attachmentsFor(event, email),
        })
        await markEmail(db, email.id, { status: "sent", providerId: id })
        if (invoiceId)
          await logInvoiceEvent(
            db,
            invoiceId,
            event.kind === "invoice.sent" ? "emailed" : "reminder",
            {
              to: email.to,
              ...(event.kind === "invoice.reminder" ? { offset: event.data.offset ?? 0 } : {}),
              ...(event.kind === "invoice.reminder" && event.data.manual
                ? { source: "manual" }
                : {}),
            },
          )
        console.log(`[email] ${email.kind} sent`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await markEmail(db, email.id, { status: "retry", error: message, attempts: email.attempts })
        if (email.attempts >= 6 && invoiceId)
          await logInvoiceEvent(db, invoiceId, "email_failed", { to: email.to })
        console.error(`[email] ${email.kind} failed (try ${email.attempts}): ${message}`)
      }
    }
  } finally {
    draining = false
  }
}
const emailTimer = setInterval(
  () => void drainEmails().catch((e) => console.error("[email] drain", e)),
  EMAIL_DRAIN_MS,
)

/** Every morning (UTC): payrolls that are due and not yet run ask their owner to approve. */
await boss.schedule(QUEUES.payrollDue.name, "0 * * * *", {})
await boss.work(QUEUES.payrollDue.name, async () => {
  await queuePayrollDue(db)
})
/** The 1st of each month: last month's statement, for each business that had movements, on each network. */
await boss.schedule(QUEUES.statementMonthly.name, "0 8 1 * *", {})
await boss.work(QUEUES.statementMonthly.name, async () => {
  const last = new Date()
  last.setUTCDate(0)
  const month = last.toISOString().slice(0, 7)
  for (const network of operators.keys()) await queueStatements(db, month, network)
})

/** The run a payroll row belongs to. */
async function runOfRow(rowId: string) {
  const [row] = await db
    .select({ runId: schema.payRows.runId })
    .from(schema.payRows)
    .where(eq(schema.payRows.id, rowId))
  return row?.runId ?? null
}
/** The cadence of the payroll a person is on, for their invite. */
async function payrollCadence(personId: string) {
  const [row] = await db
    .select({ cadence: schema.payrolls.cadence })
    .from(schema.people)
    .innerJoin(
      schema.payrolls,
      and(
        eq(schema.payrolls.workspaceId, schema.people.workspaceId),
        eq(schema.payrolls.network, schema.people.network),
      ),
    )
    .where(eq(schema.people.id, personId))
  return row?.cadence ?? null
}

// Anything approved or mid-send when the last worker stopped is picked up again.
const leftover = await unfinishedRelays(db)
for (const relay of leftover) await enqueue(boss, "relaySend", { relayId: relay.id }, relay.id)
for (const payment of await paymentsToVerify(db)) {
  await enqueue(boss, "paymentVerify", { paymentId: payment.id }, payment.id)
}
for (const grant of await queuedTestDollars(db)) {
  await enqueue(boss, "testDollars", { grantId: grant.id }, grant.id)
}
for (const destination of await destinationsToRegister(db)) {
  if (operators.has(destination.network)) {
    await enqueue(boss, "destinationRegister", { destinationId: destination.id }, destination.id)
  }
}
for (const autopilot of await autopilotsToRegister(db)) {
  if (operators.has(autopilot.network)) {
    await enqueue(boss, "autopilotRegister", { autopilotId: autopilot.id }, autopilot.id)
  }
}
// Payroll batches that landed while no worker was watching are settled now.
for (const { relayId, network } of await runRelaysToSettle(db)) {
  const operator = operators.get(network)
  if (relayId && operator) {
    const settled = await settleRunRelay(
      db,
      relayId,
      operator.accountId,
      env.ONECLICK_API_KEY,
    ).catch(() => "pending")
    console.log(`[payroll] resumed ${relayId} ${settled}`)
    const [runId] = (
      await db
        .select({ purpose: schema.relays.purpose })
        .from(schema.relays)
        .where(eq(schema.relays.id, relayId))
    ).map((r) => r.purpose.split(":")[1])
    if (runId && (settled === "paid" || settled === "failed")) await queueRunEmails(db, runId)
  }
}
for (const account of await accountsNotReady(db)) {
  if (operators.has(account.network)) {
    await enqueue(boss, "accountSetup", { accountRowId: account.id }, account.id)
  }
}

await sweepAllReferrals().catch((error) =>
  console.error("[referrals] sweep at start failed", error),
)

console.log(
  `[worker] running on ${[...operators.keys()].join(" + ")}; ${leftover.length} relays resumed`,
)

async function stop() {
  clearInterval(emailTimer)
  await boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS })
  await sql.end({ timeout: DB_CLOSE_SECONDS })
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
