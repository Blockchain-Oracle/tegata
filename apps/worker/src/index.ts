import type { NetworkId } from "@tegata/config"
import { Operator } from "@tegata/core/near"
import { createDb } from "@tegata/db"
import { migrateDb } from "@tegata/db/migrate"
import { loadDotEnv, operatorKeys, serverEnv } from "@tegata/env"
import { enqueue, QUEUES, startBoss } from "@tegata/jobs"
import {
  accountsNotReady,
  paymentsToVerify,
  processRelay,
  settlePayment,
  settleRelayedPayment,
  setupAccount,
  unfinishedRelays,
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
  // Not final yet: throw so the queue tries again with backoff.
  if (settled === "pending") throw new Error("Transaction not final yet")
})

// Anything approved or mid-send when the last worker stopped is picked up again.
const leftover = await unfinishedRelays(db)
for (const relay of leftover) await enqueue(boss, "relaySend", { relayId: relay.id }, relay.id)
for (const payment of await paymentsToVerify(db)) {
  await enqueue(boss, "paymentVerify", { paymentId: payment.id }, payment.id)
}
for (const account of await accountsNotReady(db)) {
  if (operators.has(account.network)) {
    await enqueue(boss, "accountSetup", { accountRowId: account.id }, account.id)
  }
}

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
