/**
 * Proof on testnet, through the services the app uses, of the two ways a treasury payroll gets paid besides a vote
 * Tegata relays and settles at once:
 *  - A: the deciding vote lands but Tegata never settles it (as when it's cast in Trezu): the keeper's sync finds the
 *    payout on NEAR by itself and pays the rows from USDC's own events.
 *  - B: filed while the treasury held enough, its batch fails once A has spent that money. Sending it again is refused
 *    while the proposal can still pay; the owner adds money and tries again, finalizing the same proposal, which pays.
 * Run: `pnpm --dir packages/services exec tsx src/proofs/team-settle.ts`.
 */
import { NETWORKS } from "@tegata/config"
import { newProofKey, randomHandle } from "@tegata/core/fixtures"
import { localToday } from "@tegata/core/invoices"
import {
  type DelegateDraft,
  ftTransfer,
  Operator,
  signatureToBase64,
  usdcBalance,
} from "@tegata/core/near"
import { createDb, schema } from "@tegata/db"
import { loadDotEnv, operatorKeys, serverEnv } from "@tegata/env"
import { eq } from "drizzle-orm"

import { addPerson, chooseDestination, draftRun, setSchedule } from "../payroll.ts"
import { processRelay } from "../relays.ts"
import {
  createTreasuryOnChain,
  draftFund,
  draftSeal,
  inviteApprover,
  joinTeam,
  openTreasury,
  prepareTreasuryRetry,
  prepareTreasuryRun,
  prepareVote,
  reopenTreasuryRun,
  sendRunForApproval,
  settleTreasuryRelay,
  submitTreasuryAction,
  submitTreasuryRetry,
  submitVote,
  syncTreasuryRun,
  topUpTreasury,
} from "../team.ts"
import { onboard, setupAccount } from "../users.ts"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const env = serverEnv()
const { db, sql } = createDb(env.DATABASE_URL)
const operator = new Operator("testnet", operatorKeys("testnet", env))
const usdc = NETWORKS.testnet.usdc
const CENT = 10_000n

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

const sign = (key: ReturnType<typeof newProofKey>, draft: DelegateDraft) =>
  signatureToBase64(key.sign(Uint8Array.from(Buffer.from(draft.hash, "hex"))).signature)

async function relay(relayId: string, label: string, settle = true) {
  const done = await processRelay(db, operator, relayId)
  console.log(`${label}: ${done?.status} ${done?.txHash ?? ""} ${done?.error ?? ""}`)
  if (settle)
    console.log(`  settled: ${await settleTreasuryRelay(db, relayId, operator.accountId)}`)
  return done
}

async function fundTreasury(cents: bigint, label: string) {
  const fund = await draftFund(db, {
    workspaceId,
    userId: owner.user.id,
    network: "testnet",
    publicKey: owner.key.getPublicKey().toString(),
    amount: cents * CENT,
  })
  await submitTreasuryAction(db, owner.user.id, {
    relayId: fund.relayId,
    signature: sign(owner.key, fund.draft),
  })
  await relay(fund.relayId, label)
}

async function fileRun(label: string) {
  const runId = await draftRun(db, { workspaceId, ownerId: owner.user.id, network: "testnet" })
  const proposed = await prepareTreasuryRun(db, {
    workspaceId,
    userId: owner.user.id,
    publicKey: owner.key.getPublicKey().toString(),
    runId,
  })
  const proposeRelay = await sendRunForApproval(db, {
    workspaceId,
    userId: owner.user.id,
    runId,
    approval: { relayId: proposed.relayId, signature: sign(owner.key, proposed.draft) },
  })
  await topUpTreasury(operator, proposed.treasury)
  await relay(proposeRelay, `${label}: proposal #${proposed.proposalId}`)
  return { runId, treasury: proposed.treasury }
}

async function anaVotes(runId: string, label: string, settle: boolean) {
  const vote = await prepareVote(db, {
    runId,
    userId: ana.user.id,
    publicKey: ana.key.getPublicKey().toString(),
    vote: "approve",
  })
  const voteRelay = await submitVote(db, {
    runId,
    userId: ana.user.id,
    vote: "approve",
    approval: { relayId: vote.relayId, signature: sign(ana.key, vote.draft) },
  })
  await topUpTreasury(operator, vote.treasury)
  return relay(voteRelay, label, settle)
}

async function report(runId: string, label: string) {
  const [run] = await db.select().from(schema.payRuns).where(eq(schema.payRuns.id, runId))
  const rows = await db.select().from(schema.payRows).where(eq(schema.payRows.runId, runId))
  console.log(`${label}: run ${run?.status}${run?.error ? ` (${run.error})` : ""}`)
  for (const row of rows) console.log(`  ${row.name}: ${row.status} ${row.txHash ?? ""}`)
}

const owner = await openUser("tset", "Proof Settle Studio")
const ana = await openUser("ana", "Ana Ruiz")
const ben = await openUser("ben", "Ben Osei")
const workspaceId = owner.workspace?.id ?? ""

for (const who of [ana, ben]) {
  const member = await inviteApprover(db, {
    workspaceId,
    ownerId: owner.user.id,
    network: "testnet",
    name: who === ana ? "Ana Ruiz" : "Ben Osei",
    email: who.user.email ?? "",
  })
  await joinTeam(db, member?.token ?? "", who.user)
}
const opened = await openTreasury(db, {
  workspaceId,
  ownerId: owner.user.id,
  network: "testnet",
  threshold: 2,
})
const created = await createTreasuryOnChain(db, operator, opened.id)
console.log(`Treasury ${created?.accountId}: ${created?.status} ${created?.createTx ?? ""}`)
const seal = await draftSeal(db, {
  workspaceId,
  userId: owner.user.id,
  network: "testnet",
  publicKey: owner.key.getPublicKey().toString(),
})
await submitTreasuryAction(db, owner.user.id, {
  relayId: seal.relayId,
  signature: sign(owner.key, seal.draft),
})
await relay(seal.relayId, "Seal")

// Enough for exactly one payroll: Ana and Ben, 2 cents each.
await operator.call(usdc, [ftTransfer(owner.accountId, 9n * CENT, "tegata:test-dollars")])
await fundTreasury(4n, "Fund 4 cents")
for (const [who, name] of [
  [ana, "Ana Ruiz"],
  [ben, "Ben Osei"],
] as const) {
  const person = await addPerson(db, workspaceId, "testnet", {
    name,
    email: who.user.email,
    role: "Team",
    amount: 2n * CENT,
  })
  await chooseDestination(db, person.token, who.user, { kind: "tegata" })
}

// Two payrolls filed while the treasury holds enough for one: A for today's payday, B for tomorrow's.
await setSchedule(db, {
  workspaceId,
  network: "testnet",
  timezone: "UTC",
  cadence: "monthly",
  nextPayday: localToday("UTC"),
})
const a = await fileRun("Run A")
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
await setSchedule(db, {
  workspaceId,
  network: "testnet",
  timezone: "UTC",
  cadence: "monthly",
  nextPayday: tomorrow,
})
const b = await fileRun("Run B")

// A: Ana's yes lands, but nothing in Tegata settles it. The keeper's sync has to find the payout on NEAR.
await anaVotes(a.runId, "Run A: Ana approves (left unsettled)", false)
let found = "pending"
for (let i = 0; i < 24 && found === "pending"; i++) {
  await new Promise((r) => setTimeout(r, 10_000))
  found = await syncTreasuryRun(db, a.runId, operator.accountId)
  console.log(`  keeper sync ${i + 1}: ${found}`)
}
await report(a.runId, "Run A")

// B: the treasury is empty now, so its batch fails.
await anaVotes(b.runId, "Run B: Ana approves", true)
await report(b.runId, "Run B")
try {
  await reopenTreasuryRun(db, workspaceId, b.runId)
  console.log("Run B: sent back to review (UNEXPECTED: its proposal can still pay)")
} catch (error) {
  console.log(`Run B: send again refused, as it should be: ${(error as Error).message}`)
}

// Money in, then Try again: the same proposal, finalized.
await fundTreasury(4n, "Fund 4 more cents")
const retry = await prepareTreasuryRetry(db, {
  workspaceId,
  userId: owner.user.id,
  publicKey: owner.key.getPublicKey().toString(),
  runId: b.runId,
})
const retryRelay = await submitTreasuryRetry(db, {
  workspaceId,
  userId: owner.user.id,
  runId: b.runId,
  approval: { relayId: retry.relayId, signature: sign(owner.key, retry.draft) },
})
await topUpTreasury(operator, retry.treasury)
await relay(retryRelay, `Run B: try again (finalize #${retry.proposalId})`)
await report(b.runId, "Run B")
console.log(
  `Ana holds ${await usdcBalance("testnet", ana.accountId)}, Ben holds ${await usdcBalance("testnet", ben.accountId)}, treasury ${await usdcBalance("testnet", a.treasury)}`,
)
await sql.end()
