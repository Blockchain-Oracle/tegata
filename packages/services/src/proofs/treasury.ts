// Proof on testnet: a team treasury (Sputnik DAO from the shared mainnet code) that pays a 2-row payroll only after
// 2 of 3 approvers vote yes. Owner and approvers sign with their own keys; the operator only creates and relays.
import { NETWORKS, TREASURY } from "@tegata/config"
import { newProofKey, randomHandle } from "@tegata/core/fixtures"
import {
  actProposal,
  addProposal,
  bootstrapPolicy,
  type CallSpec,
  draftDelegate,
  ftTransfer,
  Operator,
  payrollKind,
  readUsdcTransfers,
  sealCalls,
  signedDelegateAction,
  treasuryAvailable,
  treasuryConfig,
  treasuryFactoryInfo,
  treasuryLastProposalId,
  treasuryPolicy,
  treasuryProposal,
  usdcBalance,
} from "@tegata/core/near"
import { loadDotEnv, operatorKeys, serverEnv } from "@tegata/env"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const env = serverEnv()
const operator = new Operator("testnet", operatorKeys("testnet", env))
const usdc = NETWORKS.testnet.usdc
const CENT = 10_000n
const ok = (label: string, r: { status: string; hash?: string; error?: string }) => {
  console.log(label, r.status, r.hash ?? "", r.error ?? "")
  if (r.status !== "success") throw new Error(`${label} failed`)
}

async function person(prefix: string) {
  const key = newProofKey()
  const accountId = `${randomHandle(prefix)}.${operator.accountId}`
  ok(
    `create ${accountId}`,
    await operator.createUserAccount(accountId, key.getPublicKey().toString(), 0n),
  )
  ok(`register ${prefix}`, await operator.registerOnUsdc(accountId))
  return { key, accountId }
}

/** The user signs the delegate action's hash with their own key; the operator relays it and pays the gas. */
async function relayAs(
  who: { key: ReturnType<typeof newProofKey>; accountId: string },
  receiverId: string,
  calls: CallSpec[],
) {
  const draft = await draftDelegate({
    network: "testnet",
    senderId: who.accountId,
    receiverId,
    publicKey: who.key.getPublicKey().toString(),
    calls,
  })
  const signature = who.key.sign(Uint8Array.from(Buffer.from(draft.hash, "hex"))).signature
  return operator.relay(who.accountId, signedDelegateAction(draft, signature))
}

async function main() {
  const owner = await person("tr-owner")
  const ana = await person("tr-ana")
  const ben = await person("tr-ben")
  const members = {
    owner: owner.accountId,
    approvers: [owner.accountId, ana.accountId, ben.accountId],
    threshold: 2,
  }
  const treasury = `${randomHandle("tr")}-team.${operator.accountId}`

  ok(
    "create treasury",
    await operator.createTreasury(
      treasury,
      { config: treasuryConfig("Proof Team Studio"), policy: bootstrapPolicy(members) },
      TREASURY.startYocto,
      TREASURY.codeHash,
      TREASURY.initGas,
    ),
  )
  ok("register treasury on USDC", await operator.registerOnUsdc(treasury))

  ok("owner seals it", await relayAs(owner, treasury, sealCalls(members, operator.accountId)))
  console.log("factory info", await treasuryFactoryInfo("testnet", treasury))
  console.log(
    "roles",
    (await treasuryPolicy("testnet", treasury))?.roles.map(
      (r) => `${r.name}:${(r.kind.Group ?? []).length}`,
    ),
  )

  ok(
    "operator gives the owner 3 cents",
    await operator.call(usdc, [ftTransfer(owner.accountId, 3n * CENT, "tegata:test-dollars")]),
  )
  ok(
    "owner funds the treasury",
    await relayAs(owner, usdc, [ftTransfer(treasury, 3n * CENT, "tegata:fund:proof")]),
  )
  console.log("treasury holds", await usdcBalance("testnet", treasury))

  const rows = [
    { receiverId: ana.accountId, amount: CENT, memo: "tegata:payroll:proof-ana" },
    { receiverId: ben.accountId, amount: CENT, memo: "tegata:payroll:proof-ben" },
  ]
  const kind = payrollKind("testnet", rows)
  const id = (await treasuryLastProposalId("testnet", treasury)) ?? 0
  ok(
    "owner files payroll and approves (1 of 2)",
    await relayAs(owner, treasury, [
      addProposal("Payroll · proof · 2 people · $0.02", kind),
      actProposal(id, "VoteApprove", kind, 0),
    ]),
  )
  const pending = await treasuryProposal("testnet", treasury, id)
  console.log(
    "after owner",
    pending?.status,
    pending?.vote_counts,
    "ana holds",
    await usdcBalance("testnet", ana.accountId),
  )

  // A vote with the wrong kind must be refused (it can't land on another proposal).
  const wrong = await relayAs(ben, treasury, [
    actProposal(id, "VoteApprove", payrollKind("testnet", rows.slice(0, 1)), 1),
  ])
  console.log("wrong-kind vote", wrong.status, (wrong.error ?? "").slice(0, 80))

  const final = await relayAs(ana, treasury, [actProposal(id, "VoteApprove", kind, rows.length)])
  ok("ana approves (2 of 2): pays", final)
  const done = await treasuryProposal("testnet", treasury, id)
  console.log(
    "status",
    done?.status,
    "ana holds",
    await usdcBalance("testnet", ana.accountId),
    "ben holds",
    await usdcBalance("testnet", ben.accountId),
  )
  const read = await readUsdcTransfers("testnet", final.hash ?? "", operator.accountId)
  console.log(
    "usdc events",
    JSON.stringify(read, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  )
  console.log("treasury", treasury, "free NEAR", await treasuryAvailable("testnet", treasury))
  process.exit(0)
}
void main()
