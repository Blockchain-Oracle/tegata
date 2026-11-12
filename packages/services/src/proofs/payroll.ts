/**
 * Proof: payroll end to end on testnet, through the same services the app and the worker use.
 *
 *   tsx src/proofs/payroll.ts
 *
 * A proof business (its own key, its own NEAR account, $1.10 of test USDC from the operator's stash) adds three
 * people: two by hand and one from a CSV. Mei signs in with her invited email, opens her own Tegata account and
 * chooses it; Kofi gives a NEAR account that can't hold USDC yet, which Tegata's operator registers; Sara (from the
 * CSV) hasn't chosen, so the run skips her with the reason. The business signs the run's one delegate action, the
 * operator relays it, and the rows are marked paid only from the USDC contract's events. Then Mei's change of
 * destination waits its 24 hours. Prints the transaction, each payslip and each person's page.
 */

import { NETWORKS } from "@tegata/config"
import { newProofKey, randomHandle } from "@tegata/core/fixtures"
import { localToday } from "@tegata/core/invoices"
import { fromUnits } from "@tegata/core/money"
import {
  explorerTx,
  ftTransfer,
  isRegistered,
  Operator,
  signatureToBase64,
  usdcBalance,
} from "@tegata/core/near"
import { parsePeopleCsv } from "@tegata/core/payroll"
import { createDb, schema } from "@tegata/db"
import { loadDotEnv, operatorKeys, serverEnv } from "@tegata/env"

import {
  addPerson,
  approveRun,
  chooseDestination,
  draftRun,
  getRun,
  importPeople,
  listPeople,
  prepareRun,
  registerDestination,
  setSchedule,
  settleRunRelay,
} from "../payroll.ts"
import { processRelay } from "../relays.ts"
import { onboard, setupAccount } from "../users.ts"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const env = serverEnv()
const { db, sql } = createDb(env.DATABASE_URL)
const operator = new Operator("testnet", operatorKeys("testnet", env))
const usdc = NETWORKS.testnet.usdc
const CENT = 10_000n
const FUNDING = 110n * CENT

/** A Tegata user with their own key, as Privy would create one, opened as a business or a person. */
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
  return {
    user,
    key,
    handle,
    accountId: `${handle}.${operator.accountId}`,
    workspace: opened.workspace,
  }
}

console.log(
  `Operator stash: ${fromUnits(await usdcBalance("testnet", operator.accountId), 6)} USDC`,
)

// The business, funded from the stash.
const business = await openUser("payroll", "Proof Payroll Studio")
const funded = await operator.call(usdc, [
  ftTransfer(business.accountId, FUNDING, "tegata:test-dollars"),
])
if (funded.status !== "success") throw new Error(`Funding failed: ${funded.error}`)
console.log(`Business ${business.accountId} holds ${fromUnits(FUNDING, 6)} USDC`)
const workspaceId = business.workspace?.id ?? ""

// Mei: added by hand, opens her own Tegata account with the invited email and chooses it.
const mei = await openUser("mei", "Mei Tanaka")
const meiPerson = await addPerson(db, workspaceId, "testnet", {
  name: "Mei Tanaka",
  email: mei.user.email,
  role: "Designer",
  amount: 50n * CENT,
})
await chooseDestination(db, meiPerson.token, mei.user, { kind: "tegata" })
console.log(`Mei chose her Tegata account ${mei.accountId}`)

// Kofi: added by hand, gives a NEAR account that isn't registered on USDC yet; the operator registers it.
const kofiAccount = `${randomHandle("kofi")}.${operator.accountId}`
const created = await operator.createUserAccount(
  kofiAccount,
  newProofKey().getPublicKey().toString(),
  0n,
)
if (created.status !== "success")
  throw new Error(`Creating Kofi's account failed: ${created.error}`)
const kofiUser = (
  await db
    .insert(schema.users)
    .values({ email: `${randomHandle("kofi")}@proof.tegata.test` })
    .returning()
)[0]
if (!kofiUser) throw new Error("No Kofi user")
const kofiPerson = await addPerson(db, workspaceId, "testnet", {
  name: "Kofi Mensah",
  email: kofiUser.email,
  role: "Engineer",
  amount: 30n * CENT,
})
const kofiDestination = await chooseDestination(db, kofiPerson.token, kofiUser, {
  kind: "near",
  accountId: kofiAccount,
})
console.log(
  `Kofi chose ${kofiAccount}; registered on USDC already: ${Boolean(kofiDestination.readyAt)}`,
)
const registered = await registerDestination(db, operator, kofiDestination.id)
console.log(
  `Operator registered it: ${registered?.registeredTx ? explorerTx("testnet", registered.registeredTx) : "was already"}; now ${await isRegistered("testnet", usdc, kofiAccount)}`,
)

// Sara: from a CSV (with one bad row the import refuses), and she hasn't chosen yet.
const csv = parsePeopleCsv(
  [
    "name,email,role,amount",
    `Sara Okafor,${randomHandle("sara")}@proof.tegata.test,Writer,20`,
    "Nobody,not-an-email,,10",
  ].join("\n"),
)
const imported = await importPeople(db, workspaceId, "testnet", csv.rows)
console.log(
  `CSV: ${imported.added.length} added; refused: ${csv.problems.map((p) => `line ${p.line} (${p.message})`).join(", ")}`,
)

// Signing in with the wrong email can't choose for someone else.
try {
  await chooseDestination(db, meiPerson.token, kofiUser, { kind: "near", accountId: kofiAccount })
  console.log("✗ another email chose for Mei")
  process.exitCode = 1
} catch (error) {
  console.log(`✓ Another email is refused ("${(error as Error).message}")`)
}

// The schedule and the run.
await setSchedule(db, {
  workspaceId,
  network: "testnet",
  timezone: "UTC",
  cadence: "monthly",
  nextPayday: localToday("UTC"),
})
const runId = await draftRun(db, { workspaceId, ownerId: business.user.id, network: "testnet" })
const drafted = await getRun(db, workspaceId, runId)
for (const { row } of drafted.rows)
  console.log(
    `  ${row.name}: ${row.status}${row.skipReason ? ` (${row.skipReason})` : ""} ${row.accountId ?? ""}`,
  )

const prepared = await prepareRun(db, {
  workspaceId,
  userId: business.user.id,
  publicKey: business.key.getPublicKey().toString(),
  runId,
})
const signatures = prepared.batches.map((batch) => ({
  relayId: batch.relayId,
  signature: signatureToBase64(
    business.key.sign(Uint8Array.from(Buffer.from(batch.draft.hash, "hex"))).signature,
  ),
}))
console.log(
  `Signed ${signatures.length} batch(es) with ${prepared.batches[0]?.draft.calls.length} transfers`,
)
const relayIds = await approveRun(db, { workspaceId, userId: business.user.id, runId, signatures })
for (const relayId of relayIds) {
  const relay = await processRelay(db, operator, relayId)
  console.log(`Relay ${relay?.status}: ${relay?.txHash ? explorerTx("testnet", relay.txHash) : ""}`)
  console.log(`Settled: ${await settleRunRelay(db, relayId, operator.accountId)}`)
}
const done = await getRun(db, workspaceId, runId)
console.log(`Run ${done.run.status} · ${done.label} · total ${fromUnits(done.run.total, 6)} USDC`)
for (const { row } of done.rows)
  console.log(
    `  ${row.name}: ${row.status}${row.status === "paid" ? ` · payslip ${env.APP_URL}/r/slip/${row.id}` : ""}`,
  )
console.log(
  `Balances: Mei ${fromUnits(await usdcBalance("testnet", mei.accountId), 6)}, Kofi ${fromUnits(await usdcBalance("testnet", kofiAccount), 6)}, business ${fromUnits(await usdcBalance("testnet", business.accountId), 6)}`,
)

// Mei changes where pay lands: it waits 24 hours.
await chooseDestination(db, meiPerson.token, mei.user, { kind: "near", accountId: kofiAccount })
const team = await listPeople(db, workspaceId, "testnet")
const meiNow = team.find((m) => m.person.id === meiPerson.id)
console.log(
  `Mei's change waits: active ${meiNow?.ready.state === "ready" ? meiNow.ready.accountId : "none"}, pending until ${meiNow?.pending?.activatesAt.toISOString()}`,
)
await chooseDestination(db, meiPerson.token, mei.user, { kind: "tegata" })
const back = (await listPeople(db, workspaceId, "testnet")).find(
  (m) => m.person.id === meiPerson.id,
)
console.log(`Mei changed her mind: pending ${back?.pending ? "still there" : "dropped"}`)
for (const member of team)
  console.log(`Page: ${env.APP_URL}/p/${member.person.token} (${member.person.name})`)

await sql.end()
