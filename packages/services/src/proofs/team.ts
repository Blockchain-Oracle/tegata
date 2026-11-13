/**
 * Proof on testnet, through the services the app uses: a business invites two approvers (they join with their own
 * accounts), Tegata creates its team treasury (a Sputnik DAO from the shared mainnet code), the owner seals and funds it,
 * a payroll run goes for approval with the owner's yes, one approver's yes reaches 2 of 3 and the treasury pays every
 * row in one batch; rows are paid from USDC's own events and the run closes as paid.
 * Run: `pnpm --dir packages/services exec tsx src/proofs/team.ts`.
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

import { addPerson, chooseDestination, draftRun, getRun, setSchedule } from "../payroll.ts"
import { processRelay } from "../relays.ts"
import {
  createTreasuryOnChain,
  draftFund,
  draftSeal,
  inviteApprover,
  joinTeam,
  openTreasury,
  prepareTreasuryRun,
  prepareVote,
  sendRunForApproval,
  settleTreasuryRelay,
  submitTreasuryAction,
  submitVote,
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

async function relay(relayId: string, label: string) {
  const done = await processRelay(db, operator, relayId)
  console.log(`${label}: ${done?.status} ${done?.txHash ?? ""} ${done?.error ?? ""}`)
  console.log(`  settled: ${await settleTreasuryRelay(db, relayId, operator.accountId)}`)
  return done
}

const owner = await openUser("team", "Proof Team Studio")
const ana = await openUser("ana", "Ana Ruiz")
const ben = await openUser("ben", "Ben Osei")
const workspaceId = owner.workspace?.id ?? ""

// Two approvers, invited by email; each joins with their own account.
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

// The treasury: created on NEAR (the worker's job), then sealed by the owner's hold.
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

// Money in: the operator funds the owner, the owner moves 5 cents into the treasury.
await operator.call(usdc, [ftTransfer(owner.accountId, 6n * CENT, "tegata:test-dollars")])
const fund = await draftFund(db, {
  workspaceId,
  userId: owner.user.id,
  network: "testnet",
  publicKey: owner.key.getPublicKey().toString(),
  amount: 5n * CENT,
})
await submitTreasuryAction(db, owner.user.id, {
  relayId: fund.relayId,
  signature: sign(owner.key, fund.draft),
})
await relay(fund.relayId, "Fund")
console.log(`Treasury holds ${await usdcBalance("testnet", created?.accountId ?? "")}`)

// Payroll: Ana and Ben are paid 2 cents each, to their own Tegata accounts.
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
await setSchedule(db, {
  workspaceId,
  network: "testnet",
  timezone: "UTC",
  cadence: "monthly",
  nextPayday: localToday("UTC"),
})
const runId = await draftRun(db, { workspaceId, ownerId: owner.user.id, network: "testnet" })
const drafted = await getRun(db, workspaceId, runId)
console.log(
  `Run ${runId}: ${drafted.rows.map(({ row }) => `${row.name} ${row.status}`).join(", ")}`,
)

// The owner sends it for approval (filing it with their own yes).
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
  proposalId: proposed.proposalId,
  approval: { relayId: proposed.relayId, signature: sign(owner.key, proposed.draft) },
})
await topUpTreasury(operator, proposed.treasury)
await relay(proposeRelay, `Proposal #${proposed.proposalId}`)

// Ana says yes: 2 of 3, the treasury pays.
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
await relay(voteRelay, "Ana approves")

const [run] = await db.select().from(schema.payRuns).where(eq(schema.payRuns.id, runId))
const rows = await db.select().from(schema.payRows).where(eq(schema.payRows.runId, runId))
console.log(`Run ${run?.status} ${run?.txHashes.join(",")}`)
for (const row of rows) console.log(`  ${row.name}: ${row.status} ${row.txHash ?? ""}`)
console.log(
  `Ana holds ${await usdcBalance("testnet", ana.accountId)}, Ben holds ${await usdcBalance("testnet", ben.accountId)}`,
)
await sql.end()
