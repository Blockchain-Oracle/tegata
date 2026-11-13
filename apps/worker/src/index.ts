import type { NetworkId } from "@tegata/config"
import { Operator } from "@tegata/core/near"
import { createDb } from "@tegata/db"
import { migrateDb } from "@tegata/db/migrate"
import { renderInvoicePdf, resendMailer } from "@tegata/documents"
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
  deliver,
  destinationsToRegister,
  inviteEmail,
  invoiceDocuments,
  invoiceToken,
  logInvoiceEvent,
  markInvited,
  paidEmail,
  paidRowsToEmail,
  paymentsToVerify,
  pendingDeliveries,
  processRelay,
  queuedTestDollars,
  registerDestination,
  registerForAutopilot,
  reminderTarget,
  reminderTimes,
  runAutopilots,
  runDueSchedules,
  runRelaysToSettle,
  sendTestDollars,
  settleAutopilotAction,
  settleAutopilotRelay,
  settlePayment,
  settleRefund,
  settleRelayedPayment,
  settleRunRelay,
  setupAccount,
  sweepReferrals,
  unfinishedRelays,
  WEBHOOK_BACKOFF_MS,
} from "@tegata/services"

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
    ? resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM)
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
  const relay = await processRelay(db, operator, relayId)
  if (relay) console.log(`[relay] ${relay.purpose} ${relay.status} ${relay.txHash ?? ""}`)
  // A payment from a Tegata balance settles as soon as its relay lands.
  if (relay?.purpose.startsWith("pay:")) {
    const settled = await settleRelayedPayment(db, relay.id, operator.accountId)
    console.log(`[payment] ${relay.purpose} ${settled}`)
  }
  // Autopilot: once the plan's relay lands, read its id from the contract; turning it off ends it.
  if (relay?.purpose.startsWith("autopilot:")) {
    const on = await settleAutopilotRelay(db, relay.id)
    await settleAutopilotAction(db, relay.id)
    console.log(`[autopilot] ${relay.purpose} ${relay.status} ${on}`)
  }
  // A refund: once it lands, it counts against the payment.
  if (relay?.purpose.startsWith("refund:")) {
    const payment = await settleRefund(db, relay.id)
    if (payment) console.log(`[refund] ${payment.id} refunded ${payment.refunded}`)
  }
  // A settled payment or refund may have raised webhook events: send them now rather than at the next sweep.
  if (relay?.purpose.startsWith("pay:") || relay?.purpose.startsWith("refund:"))
    await queueDeliveries()
  // A payroll batch: its rows are paid only once the USDC events are read from NEAR.
  if (relay?.purpose.startsWith("run:")) {
    const settled = await settleRunRelay(db, relay.id, operator.accountId)
    console.log(`[payroll] ${relay.purpose} ${settled}`)
    if (settled === "paid" && mailer) {
      for (const row of await paidRowsToEmail(db, relay.purpose.split(":")[1] ?? "")) {
        await enqueue(boss, "payrollEmail", { kind: "paid", id: row.id }, `paid:${row.id}`)
      }
    }
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
})

await boss.work(QUEUES.paymentVerify.name, async ([job]) => {
  if (!job) return
  const { paymentId } = QUEUES.paymentVerify.payload.parse(job.data)
  const [payment] = (await paymentsToVerify(db)).filter((p) => p.id === paymentId)
  if (!payment?.txHash || !payment.payer) return
  const settled = await settlePayment(db, payment.id, payment.txHash, payment.payer)
  console.log(`[payment] ${payment.id} ${settled}`)
  if (settled === "succeeded") await queueDeliveries()
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

await boss.work(QUEUES.invoiceEmail.name, async ([job]) => {
  if (!job || !mailer) return
  const { invoiceId, kind, offset } = QUEUES.invoiceEmail.payload.parse(job.data)
  const sent = await invoiceToken(db, invoiceId)
  if (!sent) return
  if (kind === "reminder" && !(await reminderTarget(db, invoiceId))) return
  const docs = await invoiceDocuments(db, sent.token, env.APP_URL)
  if (!docs?.to || docs.document.status !== "open") return
  if (kind === "invoice") {
    const pdf = await renderInvoicePdf(docs.document)
    await mailer.invoice({ to: docs.to, data: docs.email, pdf, key: `${invoiceId}:invoice` })
    await logInvoiceEvent(db, invoiceId, "emailed", { to: docs.to })
  } else {
    await mailer.reminder({
      to: docs.to,
      data: docs.email,
      offset: offset ?? 0,
      key: `${invoiceId}:remind:${offset}`,
    })
    await logInvoiceEvent(db, invoiceId, "reminder", { to: docs.to, offset: offset ?? 0 })
  }
  console.log(`[email] ${kind} for ${docs.document.number} sent`)
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
  if (result)
    console.log(
      `[webhook] ${deliveryId} ${result.status}${result.retryInMs ? ` (next in ${result.retryInMs / 1000}s)` : ""}`,
    )
})
const WEBHOOK_CRON = "* * * * *"
await boss.schedule(QUEUES.webhookSweep.name, WEBHOOK_CRON, {})
await boss.work(QUEUES.webhookSweep.name, queueDeliveries)

/** Payroll emails: "added you to payroll" when someone is added, "you've been paid" for each paid row. */
await boss.work(QUEUES.payrollEmail.name, async ([job]) => {
  if (!job || !mailer) return
  const { kind, id } = QUEUES.payrollEmail.payload.parse(job.data)
  if (kind === "invite") {
    const email = await inviteEmail(db, id, env.APP_URL)
    if (!email) return
    await mailer.payrollInvite({ ...email, key: `invite:${id}` })
    await markInvited(db, id)
  } else {
    const email = await paidEmail(db, id, env.APP_URL)
    if (!email) return
    await mailer.paid({ ...email, key: `paid:${id}` })
  }
  console.log(`[email] payroll ${kind} ${id} sent`)
})

/** Repeating invoices: every ten minutes, issue and send those that are due. */
const REPEAT_CRON = "*/10 * * * *"
await boss.schedule(QUEUES.invoiceRepeat.name, REPEAT_CRON, {})
await boss.work(QUEUES.invoiceRepeat.name, async () => {
  for (const issued of await runDueSchedules(db)) {
    console.log(`[repeat] issued ${issued.invoiceId}`)
    if (!mailer) continue
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
  for (const operator of operators.values()) {
    const { checked, paid } = await sweepReferrals(db, operator)
    if (paid.length)
      console.log(`[referrals] ${operator.network}: ${checked} checked, ${paid.length} paid`)
  }
}
await boss.schedule(QUEUES.referralSweep.name, REFERRAL_CRON, {})
await boss.work(QUEUES.referralSweep.name, sweepAllReferrals)

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
  await boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS })
  await sql.end({ timeout: DB_CLOSE_SECONDS })
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
