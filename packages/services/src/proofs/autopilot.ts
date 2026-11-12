/**
 * Proof: the autopilot end to end on testnet (plan S05 "done when"), through the services the app and worker use.
 *
 *   tsx src/proofs/autopilot.ts
 *
 * A proof business (its own key and NEAR account, $0.40 of test USDC from the operator's stash) pays three people who
 * each opened a Tegata account. It turns the autopilot on the way the Payroll page does: the operator registers it on
 * `pay.tegata.testnet`, then the business signs two gas-free actions together (set $0.30 aside, create the plan) and
 * the operator relays them in order. The only change from the app: the first payday is set to about six minutes from
 * now instead of 09:00 on the next payday, so the proof doesn't wait a day. Then nobody does anything: the keeper (the
 * worker's own function) calls `run` once the time has passed, and the run is recorded from the contract's events. At
 * the end the business turns autopilot off and the plan's storage goes back to the operator.
 */

import { NETWORKS } from "@tegata/config"
import { newProofKey, randomHandle } from "@tegata/core/fixtures"
import { fromUnits } from "@tegata/core/money"
import {
  autopilotPlan,
  explorerTx,
  ftTransfer,
  Operator,
  signatureToBase64,
  usdcBalance,
} from "@tegata/core/near"
import { createDb, schema } from "@tegata/db"
import { loadDotEnv, operatorKeys, serverEnv } from "@tegata/env"
import { eq } from "drizzle-orm"

import {
  approveAutopilot,
  autopilotState,
  draftAutopilot,
  draftAutopilotAction,
  prepareAutopilot,
  registerForAutopilot,
  runAutopilots,
  settleAutopilotAction,
  settleAutopilotRelay,
} from "../autopilot.ts"
import { addPerson, chooseDestination, getRun, setSchedule } from "../payroll.ts"
import { processRelay, submitRelaySignature } from "../relays.ts"
import { onboard, setupAccount } from "../users.ts"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const env = serverEnv()
const { db, sql } = createDb(env.DATABASE_URL)
const operator = new Operator("testnet", operatorKeys("testnet", env))
const CENT = 10_000n
const FIRST_PAYDAY_IN_MS = 6 * 60 * 1000
const DAY_MS = 86_400_000
const WAIT_STEP_MS = 15_000

async function openUser(prefix: string, name: string) {
  const handle = randomHandle(prefix)
  const key = newProofKey()
  const [user] = await db
    .insert(schema.users)
    .values({ email: `${handle}@proof.tegata.test`, publicKey: key.getPublicKey().toString() })
    .returning()
  if (!user) throw new Error("Could not create the proof user")
  const opened = await onboard(db, {
    userId: user.id,
    handle,
    businessName: name,
    timezone: "UTC",
    networks: ["testnet"],
  })
  for (const account of opened.accounts) await setupAccount(db, operator, account.id)
  return { user, key, accountId: `${handle}.${operator.accountId}`, workspace: opened.workspace }
}

const sign = (key: ReturnType<typeof newProofKey>, hash: string) =>
  signatureToBase64(key.sign(Uint8Array.from(Buffer.from(hash, "hex"))).signature)

const business = await openUser("autopilot", "Proof Autopilot Studio")
const workspaceId = business.workspace?.id ?? ""
const funded = await operator.call(NETWORKS.testnet.usdc, [
  ftTransfer(business.accountId, 40n * CENT, "tegata:test-dollars"),
])
console.log(`Business ${business.accountId} funded: ${funded.status}`)

const people = []
for (const [prefix, name] of [
  ["ana", "Ana Silva"],
  ["ben", "Ben Okoro"],
  ["chi", "Chi Wong"],
] as const) {
  const person = await openUser(prefix, name)
  const row = await addPerson(db, workspaceId, "testnet", {
    name,
    email: person.user.email,
    amount: 10n * CENT,
  })
  await chooseDestination(db, row.token, person.user, { kind: "tegata" })
  people.push(person)
}
console.log(`People: ${people.map((p) => p.accountId).join(", ")}`)

await setSchedule(db, {
  workspaceId,
  network: "testnet",
  timezone: "UTC",
  cadence: "weekly",
  nextPayday: new Date(Date.now() + DAY_MS).toISOString().slice(0, 10),
})
const prepared = await prepareAutopilot(db, {
  workspaceId,
  ownerId: business.user.id,
  network: "testnet",
  timezone: "UTC",
  count: 3,
  setAside: 30n * CENT,
})
// The one change from the app: the first payday in about six minutes, the next two a day apart.
const first = Date.now() + FIRST_PAYDAY_IN_MS
await db
  .update(schema.autopilotPlans)
  .set({ dueMs: [first, first + DAY_MS, first + 2 * DAY_MS] })
  .where(eq(schema.autopilotPlans.id, prepared.id))
const ready = await registerForAutopilot(db, operator, prepared.id)
console.log(
  `Registered on ${NETWORKS.testnet.autopilot}: ${ready?.status} ${ready?.registerTx ? explorerTx("testnet", ready.registerTx) : ""}`,
)

const drafts = await draftAutopilot(db, {
  workspaceId,
  userId: business.user.id,
  publicKey: business.key.getPublicKey().toString(),
  id: prepared.id,
})
const order = await approveAutopilot(db, {
  workspaceId,
  userId: business.user.id,
  id: prepared.id,
  signatures: [
    { relayId: drafts.deposit.relayId, signature: sign(business.key, drafts.deposit.draft.hash) },
    { relayId: drafts.plan.relayId, signature: sign(business.key, drafts.plan.draft.hash) },
  ],
})
for (const relayId of order) {
  const relay = await processRelay(db, operator, relayId)
  console.log(
    `${relay?.purpose}: ${relay?.status} ${relay?.txHash ? explorerTx("testnet", relay.txHash) : ""} ${relay?.error ?? ""}`,
  )
  await settleAutopilotRelay(db, relayId)
}
const on = await autopilotState(db, workspaceId, "testnet")
console.log(
  `Autopilot ${on.row?.status}, plan ${on.row?.planId}; set aside ${fromUnits(BigInt(on.business?.available ?? "0"), 6)} USDC`,
)

console.log(`Waiting for ${new Date(first).toISOString()} (nobody does anything)…`)
while (Date.now() < first + 5_000) await new Promise((r) => setTimeout(r, WAIT_STEP_MS))
let ran: string[] = []
for (let i = 0; i < 8 && !ran.length; i++) {
  ran = await runAutopilots(db, operator)
  if (!ran.length) await new Promise((r) => setTimeout(r, WAIT_STEP_MS))
}
console.log(`Keeper ran: ${ran.join(", ")}`)
const [run] = await db
  .select()
  .from(schema.payRuns)
  .where(eq(schema.payRuns.autopilotId, prepared.id))
if (run) {
  const view = await getRun(db, workspaceId, run.id)
  console.log(
    `Run ${view.run.status} (${view.run.source}) · ${view.label} · ${view.run.txHashes.map((h) => explorerTx("testnet", h)).join(" ")}`,
  )
  for (const { row } of view.rows)
    console.log(`  ${row.name}: ${row.status} · ${env.APP_URL}/r/slip/${row.id}`)
}
for (const person of people)
  console.log(
    `  ${person.accountId}: ${fromUnits(await usdcBalance("testnet", person.accountId), 6)} USDC`,
  )
const plan = await autopilotPlan("testnet", on.row?.planId ?? "")
console.log(`On NEAR: next ${plan?.next}, paid ${plan?.last_paid}, failed ${plan?.last_failed}`)

// Turn it off: the plan is cancelled and its storage goes back to the operator.
const off = await draftAutopilotAction(db, {
  workspaceId,
  userId: business.user.id,
  publicKey: business.key.getPublicKey().toString(),
  id: prepared.id,
  action: "off",
})
await submitRelaySignature(db, {
  relayId: off.relayId,
  userId: business.user.id,
  signature: sign(business.key, off.draft.hash),
})
const cancelled = await processRelay(db, operator, off.relayId)
await settleAutopilotAction(db, off.relayId)
console.log(
  `Turned off: ${cancelled?.status} ${cancelled?.txHash ? explorerTx("testnet", cancelled.txHash) : ""}`,
)
await sql.end()
