import type { NetworkId } from "@tegata/config"
import { Operator } from "@tegata/core/near"
import { createDb, schema } from "@tegata/db"
import { migrateDb } from "@tegata/db/migrate"
import {
  type EmailEvent,
  renderInvoicePdf,
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
  claimEmails,
  deliver,
  destinationsToRegister,
  invoiceDocuments,
  invoiceToken,
  logInvoiceEvent,
  markEmail,
  markInvited,
  monthStatement,
  oneClickToPoll,
  paymentsToVerify,
  payoutsToPoll,
  pendingDeliveries,
  pollOneClickPayment,
  pollPayout,
  processRelay,
  queueAccountEmail,
  queueAutopilotOn,
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
  reminderTarget,
  reminderTimes,
  runAutopilots,
  runDueSchedules,
  runRelaysToSettle,
  sendTestDollars,
  settleAutopilotAction,
  settleAutopilotRelay,
  settlePayment,
  settlePayoutRelay,
  settleRefund,
  settleRelayedPayment,
  settleRunRelay,
  setupAccount,
  sweepReferrals,
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

/** Email goes out only when Resend and a verified sender are set; otherwise invoices are shared by link. */
const mailer =
  emailConfigured(env) && env.RESEND_API_KEY && env.EMAIL_FROM
    ? resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM, env.APP_URL.replace(/\/$/, ""))
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
  // A payroll batch: its rows are paid only once the USDC events are read from NEAR.
  if (relay?.purpose.startsWith("run:")) {
    const settled = await settleRunRelay(db, relay.id, operator.accountId)
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
  const { invoiceId, kind, offset } = QUEUES.invoiceEmail.payload.parse(job.data)
  const sent = await invoiceToken(db, invoiceId)
  if (!sent) return
  if (kind === "reminder" && !(await reminderTarget(db, invoiceId))) return
  await queueInvoiceEmail(db, invoiceId, kind === "invoice" ? "invoice.sent" : "invoice.reminder", {
    offset: offset ?? 0,
  })
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

/** Replies to a customer or payroll email reach the business. */
async function replyToFor(workspaceId: string | null) {
  if (!workspaceId) return null
  const [row] = await db
    .select({ email: schema.workspaces.email })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
  return row?.email ?? null
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
await boss.schedule(QUEUES.payrollDue.name, "0 7 * * *", {})
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
    const settled = await settleRunRelay(db, relayId, operator.accountId).catch(() => "pending")
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
