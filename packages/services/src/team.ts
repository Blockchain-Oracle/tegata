// Team approvals. The owner invites approvers by email; once they've joined, Tegata creates the business a team
// treasury on NEAR (a Sputnik DAO) whose policy needs k of them, and the owner seals it with one hold. Payroll paid from
// it is filed as one proposal with the owner's yes; each approver votes with their own key through the relayer; the
// vote that reaches k pays every row in one batch. Rows are paid only from USDC's own events, as everywhere else.
import { NETWORKS, type NetworkId, TREASURY } from "@tegata/config"
import {
  accountExists,
  actProposal,
  addProposal,
  bootstrapPolicy,
  factoryCreate,
  ftTransfer,
  isRegistered,
  matchingTransfer,
  type Operator,
  type ProposalKind,
  payrollKind,
  readUsdcTransfers,
  sealCalls,
  type TreasuryMembers,
  treasuryAccountId,
  treasuryAvailable,
  treasuryConfig,
  treasuryFactoryInfo,
  treasuryLastProposalId,
  treasuryPolicy,
  treasuryProposal,
  usdcBalance,
} from "@tegata/core/near"
import { periodLabel } from "@tegata/core/payroll"
import { type Db, schema } from "@tegata/db"
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm"

import { BUSINESS_HEADER, headerLogo, publicToken } from "./payments.ts"
import { closeRun, maskEmail, payrollMemo } from "./payroll.ts"
import { applySplitToAccount } from "./pots.ts"
import { type Approval, createRelayDraft, submitRelaySignature } from "./relays.ts"

const { teamMembers, treasuries, runVotes, payRuns, payRows, accounts, workspaces, users, relays } =
  schema

const TOKEN_LENGTH = 14
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NS_PER_MS = 1_000_000n

export class TeamError extends Error {
  constructor(
    readonly code:
      | "bad_input"
      | "not_found"
      | "forbidden"
      | "wrong_state"
      | "not_ready"
      | "duplicate"
      | "limit",
    message: string,
  ) {
    super(message)
  }
}

type Treasury = typeof treasuries.$inferSelect
type Member = typeof teamMembers.$inferSelect

async function ownerAccount(db: Db, userId: string, network: NetworkId) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.network, network)))
  if (!account?.readyAt) throw new TeamError("not_ready", "Your account is still being set up")
  return account
}

async function treasuryOf(db: Db, workspaceId: string, network: NetworkId) {
  const [row] = await db
    .select()
    .from(treasuries)
    .where(and(eq(treasuries.workspaceId, workspaceId), eq(treasuries.network, network)))
  return row ?? null
}

const membersOf = (t: Treasury): TreasuryMembers => ({
  owner: t.approvers[0] ?? "",
  approvers: t.approvers,
  threshold: t.threshold,
})

/** Who may change a treasury's code: on mainnet the factory, on testnet the operator that created it (switched off at the seal). */
const factoryOf = (network: NetworkId) =>
  network === "mainnet" ? TREASURY.mainnetFactory : NETWORKS.testnet.operator

// --- the team ------------------------------------------------------------------------------------------------

/** The owner, the approvers they invited, and the treasury if there is one. */
export async function teamView(db: Db, workspaceId: string, ownerId: string, network: NetworkId) {
  const [members, treasury, [owner]] = await Promise.all([
    db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.workspaceId, workspaceId),
          eq(teamMembers.network, network),
          ne(teamMembers.status, "removed"),
        ),
      )
      .orderBy(asc(teamMembers.createdAt)),
    treasuryOf(db, workspaceId, network),
    db
      .select({ accountId: accounts.accountId })
      .from(accounts)
      .where(and(eq(accounts.userId, ownerId), eq(accounts.network, network))),
  ])
  return {
    ownerAccount: owner?.accountId ?? null,
    members,
    treasury: treasury && {
      ...treasury,
      balance: treasury.status === "ready" ? await usdcBalance(network, treasury.accountId) : 0n,
    },
  }
}

export async function inviteApprover(
  db: Db,
  input: { workspaceId: string; ownerId: string; network: NetworkId; name: string; email: string },
) {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name || name.length > 80) throw new TeamError("bad_input", "Add their name")
  if (!EMAIL.test(email) || email.length > 120)
    throw new TeamError("bad_input", "That isn't an email address")
  const treasury = await treasuryOf(db, input.workspaceId, input.network)
  if (treasury && treasury.status !== "failed")
    throw new TeamError(
      "wrong_state",
      "The treasury is open: its approvers change by their own vote",
    )
  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.ownerId))
  if (owner?.email?.toLowerCase() === email)
    throw new TeamError("bad_input", "You approve already, as the owner")
  const current = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.workspaceId, input.workspaceId), eq(teamMembers.network, input.network)),
    )
  const existing = current.find((m) => m.email === email)
  if (existing && existing.status !== "removed")
    throw new TeamError("duplicate", `${existing.name} is already invited with ${email}`)
  if (current.filter((m) => m.status !== "removed").length + 1 >= TREASURY.maxApprovers)
    throw new TeamError("limit", `A treasury can have up to ${TREASURY.maxApprovers} approvers`)
  if (existing) {
    const [back] = await db
      .update(teamMembers)
      .set({
        name,
        status: "invited",
        userId: null,
        accountId: null,
        joinedAt: null,
        invitedAt: new Date(),
      })
      .where(eq(teamMembers.id, existing.id))
      .returning()
    return back
  }
  const [row] = await db
    .insert(teamMembers)
    .values({
      workspaceId: input.workspaceId,
      network: input.network,
      name,
      email,
      token: publicToken(TOKEN_LENGTH),
      invitedAt: new Date(),
    })
    .returning()
  return row
}

export async function removeApprover(db: Db, workspaceId: string, memberId: string) {
  if (!UUID.test(memberId)) throw new TeamError("not_found", "No such approver")
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.workspaceId, workspaceId)))
  if (!member) throw new TeamError("not_found", "No such approver")
  const treasury = await treasuryOf(db, workspaceId, member.network)
  if (treasury && treasury.status !== "failed")
    throw new TeamError(
      "wrong_state",
      "The treasury is open: its approvers change by their own vote",
    )
  await db.update(teamMembers).set({ status: "removed" }).where(eq(teamMembers.id, member.id))
}

/** The invite page: who asked, who for, and whether it's done. */
export async function teamInvite(db: Db, token: string) {
  const [row] = await db
    .select({ member: teamMembers, ...BUSINESS_HEADER })
    .from(teamMembers)
    .innerJoin(workspaces, eq(workspaces.id, teamMembers.workspaceId))
    .where(and(eq(teamMembers.token, token), ne(teamMembers.status, "removed")))
  if (!row) return null
  return {
    token,
    name: row.member.name,
    emailHint: maskEmail(row.member.email),
    network: row.member.network,
    business: row.business,
    logo: headerLogo(row),
    joined: row.member.status === "active",
    accountId: row.member.accountId,
  }
}

/** Only someone signed in with the invited email may join, with their own account on that network. */
export async function joinTeam(db: Db, token: string, user: { id: string; email: string | null }) {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.token, token), ne(teamMembers.status, "removed")))
  if (!member) throw new TeamError("not_found", "This invite has closed")
  if (member.userId && member.userId !== user.id)
    throw new TeamError("forbidden", "Someone else already joined with this invite")
  if (user.email?.toLowerCase() !== member.email)
    throw new TeamError(
      "forbidden",
      `Sign in with ${maskEmail(member.email)}, the email you were invited with`,
    )
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.network, member.network)))
  if (!account?.readyAt) throw new TeamError("not_ready", "Open your Tegata account first")
  const [joined] = await db
    .update(teamMembers)
    .set({ userId: user.id, accountId: account.accountId, status: "active", joinedAt: new Date() })
    .where(eq(teamMembers.id, member.id))
    .returning()
  return joined as Member
}

// --- the treasury ----------------------------------------------------------------------------------------------

/** Every approver has joined and k is sensible: record the treasury; the worker creates it on NEAR. */
export async function openTreasury(
  db: Db,
  input: {
    workspaceId: string
    ownerId: string
    network: NetworkId
    threshold: number
    /** Mainnet treasuries cost the operator real NEAR: they open only once switched on. */
    liveAllowed?: boolean
  },
) {
  if (input.network === "mainnet" && !input.liveAllowed)
    throw new TeamError(
      "not_ready",
      "Team treasuries open on Live soon. Try one in the Sandbox now.",
    )
  const existing = await treasuryOf(db, input.workspaceId, input.network)
  if (existing && existing.status !== "failed")
    throw new TeamError("wrong_state", "The treasury is already open")
  const owner = await ownerAccount(db, input.ownerId, input.network)
  const members = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.workspaceId, input.workspaceId),
        eq(teamMembers.network, input.network),
        ne(teamMembers.status, "removed"),
      ),
    )
  const waiting = members.filter((m) => m.status !== "active" || !m.accountId)
  if (waiting.length)
    throw new TeamError("not_ready", `Waiting for ${waiting.map((m) => m.name).join(", ")} to join`)
  const approvers = [owner.accountId, ...members.flatMap((m) => (m.accountId ? [m.accountId] : []))]
  const k = input.threshold
  if (!Number.isInteger(k) || k < TREASURY.minThreshold || k > approvers.length)
    throw new TeamError(
      "bad_input",
      approvers.length < TREASURY.minThreshold
        ? "Invite at least one approver first"
        : `Pick between ${TREASURY.minThreshold} and ${approvers.length} approvals`,
    )
  const [ownerUser] = await db
    .select({ handle: users.handle })
    .from(users)
    .where(eq(users.id, input.ownerId))
  const handle = (ownerUser?.handle ?? owner.accountId.split(".")[0] ?? "team").replace(
    /[^a-z0-9-]/g,
    "",
  )
  let accountId = treasuryAccountId(input.network, handle)
  if (await accountExists(input.network, accountId))
    accountId = treasuryAccountId(input.network, `${handle}-${publicToken(4).toLowerCase()}`)
  const values = {
    workspaceId: input.workspaceId,
    network: input.network,
    accountId,
    threshold: k,
    approvers,
    status: "creating" as const,
    error: null,
    createTx: null,
    sealRelayId: null,
  }
  const [row] = existing
    ? await db.update(treasuries).set(values).where(eq(treasuries.id, existing.id)).returning()
    : await db.insert(treasuries).values(values).returning()
  if (!row) throw new Error("Could not record the treasury")
  return row
}

/** Worker: create the treasury on NEAR (testnet: from the shared DAO code; mainnet: the factory), register it for USDC. */
export async function createTreasuryOnChain(
  db: Db,
  operator: Operator,
  treasuryId: string,
  liveAllowed = false,
) {
  const [t] = await db.select().from(treasuries).where(eq(treasuries.id, treasuryId))
  if (t?.status !== "creating") return t
  if (t.network === "mainnet" && !liveAllowed) return t
  const [business] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, t.workspaceId))
  const init = {
    config: treasuryConfig(business?.name ?? "Tegata business"),
    policy: bootstrapPolicy(membersOf(t)),
  }
  let createTx: string | null = null
  if (!(await accountExists(t.network, t.accountId))) {
    const created =
      t.network === "mainnet"
        ? await operator.call(TREASURY.mainnetFactory, [
            factoryCreate(t.accountId.slice(0, -`.${TREASURY.mainnetFactory}`.length), init),
          ])
        : await operator.createTreasury(
            t.accountId,
            init,
            TREASURY.startYocto,
            TREASURY.codeHash,
            TREASURY.initGas,
          )
    if (created.status !== "success") {
      const [failed] = await db
        .update(treasuries)
        .set({ status: "failed", error: created.error ?? "NEAR didn't create the treasury" })
        .where(eq(treasuries.id, t.id))
        .returning()
      return failed
    }
    createTx = created.hash ?? null
  }
  if (!(await isRegistered(t.network, NETWORKS[t.network].usdc, t.accountId))) {
    const registered = await operator.registerOnUsdc(t.accountId)
    if (registered.status !== "success")
      throw new Error(`Registering the treasury failed: ${registered.error}`)
  }
  const [row] = await db
    .update(treasuries)
    .set({ status: "sealing", ...(createTx ? { createTx } : {}), error: null })
    .where(eq(treasuries.id, t.id))
    .returning()
  return row
}

/** The owner's hold that seals it: no automatic code updates, then every change needs the approvers. */
export async function draftSeal(
  db: Db,
  input: { workspaceId: string; userId: string; network: NetworkId; publicKey: string },
) {
  const t = await treasuryOf(db, input.workspaceId, input.network)
  if (t?.status !== "sealing")
    throw new TeamError("wrong_state", "The treasury isn't waiting to be sealed")
  const owner = await ownerAccount(db, input.userId, input.network)
  if (owner.accountId !== t.approvers[0])
    throw new TeamError("forbidden", "Only the owner seals the treasury")
  const draft = await createRelayDraft(db, {
    userId: input.userId,
    network: input.network,
    purpose: `treasury-seal:${t.id}`,
    senderId: owner.accountId,
    receiverId: t.accountId,
    publicKey: input.publicKey,
    calls: sealCalls(membersOf(t), factoryOf(input.network)),
  })
  return { ...draft, treasuryId: t.id }
}

/** The owner moves dollars from their balance into the treasury: one gas-free transfer. */
export async function draftFund(
  db: Db,
  input: {
    workspaceId: string
    userId: string
    network: NetworkId
    publicKey: string
    amount: bigint
  },
) {
  const t = await treasuryOf(db, input.workspaceId, input.network)
  if (t?.status !== "ready") throw new TeamError("wrong_state", "The treasury isn't ready yet")
  const owner = await ownerAccount(db, input.userId, input.network)
  if (input.amount <= 0n) throw new TeamError("bad_input", "Enter an amount above $0")
  if ((await usdcBalance(input.network, owner.accountId)) < input.amount)
    throw new TeamError("bad_input", "That's more than your balance")
  return createRelayDraft(db, {
    userId: input.userId,
    network: input.network,
    purpose: `treasury-fund:${t.id}:${crypto.randomUUID().slice(0, 8)}`,
    senderId: owner.accountId,
    receiverId: NETWORKS[input.network].usdc,
    publicKey: input.publicKey,
    calls: [ftTransfer(t.accountId, input.amount, `tegata:fund:${t.id}`)],
  })
}

/** Store the owner's approval of the seal or a transfer into the treasury; the caller queues the relay. */
export function submitTreasuryAction(db: Db, userId: string, approval: Approval) {
  return submitRelaySignature(db, {
    ...approval,
    userId,
    purposes: ["treasury-seal:", "treasury-fund:"],
  })
}

/** Worker, before relaying a proposal or a vote: the treasury pays its own storage, so keep it some NEAR. */
export async function topUpTreasury(operator: Operator, treasuryAccount: string) {
  const free = BigInt((await treasuryAvailable(operator.network, treasuryAccount)) ?? "0")
  if (free >= TREASURY.minFreeYocto) return null
  return operator.sendNear(treasuryAccount, TREASURY.topUpYocto)
}

/** Worker: every ready treasury keeps enough NEAR for its next proposals. */
export async function topUpTreasuries(db: Db, operator: Operator) {
  const ready = await db
    .select()
    .from(treasuries)
    .where(and(eq(treasuries.network, operator.network), eq(treasuries.status, "ready")))
  for (const t of ready) await topUpTreasury(operator, t.accountId)
}

// --- runs ------------------------------------------------------------------------------------------------------

async function runRows(db: Db, runId: string) {
  return db
    .select()
    .from(payRows)
    .where(and(eq(payRows.runId, runId), eq(payRows.status, "included")))
    .orderBy(asc(payRows.name), asc(payRows.id))
}

const transfersOf = (rows: (typeof payRows.$inferSelect)[]) =>
  rows.map((row) => ({
    receiverId: row.accountId ?? "",
    amount: row.amount,
    memo: payrollMemo(row.id),
  }))

/** Same proposal, field for field (the chain stores what was filed; key order is ours on both sides). */
const sameKind = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Slack over a proposal's end for the difference between Tegata's clock and NEAR's block time. */
const CLOCK_MARGIN_MS = 10 * 60_000

/** The act_proposal call in a drafted treasury action, as signed: its proposal id and action. */
function draftedAct(draft: unknown): { id?: unknown; action?: unknown } | null {
  const calls = (draft as { calls?: { method: string; argsJson: string }[] } | null)?.calls ?? []
  const act = calls.find((c) => c.method === "act_proposal")
  if (!act) return null
  try {
    return JSON.parse(act.argsJson) as { id?: unknown; action?: unknown }
  } catch {
    return null
  }
}

function draftedProposalId(draft: unknown): number | null {
  const id = draftedAct(draft)?.id
  return typeof id === "number" && Number.isInteger(id) && id >= 0 ? id : null
}

const draftedAction = (draft: unknown) => draftedAct(draft)?.action

/** The run as one proposal, filed with the owner's own yes in the same action. */
export async function prepareTreasuryRun(
  db: Db,
  input: { workspaceId: string; userId: string; publicKey: string; runId: string },
) {
  if (!UUID.test(input.runId)) throw new TeamError("not_found", "No such run")
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, input.runId), eq(payRuns.workspaceId, input.workspaceId)))
  if (!run) throw new TeamError("not_found", "No such run")
  if (run.status !== "draft") throw new TeamError("wrong_state", "This run is already on its way")
  const t = await treasuryOf(db, input.workspaceId, run.network)
  if (t?.status !== "ready") throw new TeamError("wrong_state", "The team treasury isn't ready")
  const owner = await ownerAccount(db, input.userId, run.network)
  const rows = await runRows(db, run.id)
  if (!rows.length) throw new TeamError("bad_input", "Nobody in this run is ready to be paid")
  if (rows.some((row) => row.destinationKind === "chain" || !row.accountId))
    throw new TeamError(
      "bad_input",
      "The team treasury pays NEAR accounts only: leave rows for another chain out of this run",
    )
  if (rows.length > TREASURY.maxRows)
    throw new TeamError("limit", `A treasury payroll pays up to ${TREASURY.maxRows} people at once`)
  const total = rows.reduce((sum, row) => sum + row.amount, 0n)
  const held = await usdcBalance(run.network, t.accountId)
  if (held < total)
    throw new TeamError(
      "not_ready",
      `The treasury holds $${(Number(held) / 1e6).toFixed(2)}: add $${(Number(total - held) / 1e6).toFixed(2)} first`,
    )
  const kind = payrollKind(run.network, transfersOf(rows))
  const proposalId = (await treasuryLastProposalId(run.network, t.accountId)) ?? 0
  const label = periodLabel({ from: run.periodFrom, to: run.periodTo })
  const description = `* Title: ${label} <br>* Notes: ${rows.length} people · $${(Number(total) / 1e6).toFixed(2)} · Tegata run ${run.id.slice(0, 8)}`
  const draft = await createRelayDraft(db, {
    userId: input.userId,
    network: run.network,
    purpose: `treasury-propose:${run.id}:${run.attempt}`,
    senderId: owner.accountId,
    receiverId: t.accountId,
    publicKey: input.publicKey,
    calls: [addProposal(description, kind), actProposal(proposalId, "VoteApprove", kind, 0)],
  })
  return {
    ...draft,
    proposalId,
    treasury: t.accountId,
    usdc: NETWORKS[run.network].usdc,
    rows: rows.map((row) => ({
      id: row.id,
      accountId: row.accountId,
      amount: row.amount.toString(),
    })),
  }
}

/** The owner signed: the run waits for its approvers. */
export async function sendRunForApproval(
  db: Db,
  input: {
    workspaceId: string
    userId: string
    runId: string
    approval: Approval
  },
) {
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, input.runId), eq(payRuns.workspaceId, input.workspaceId)))
  if (run?.status !== "draft") throw new TeamError("wrong_state", "This run is already on its way")
  const t = await treasuryOf(db, input.workspaceId, run.network)
  if (!t) throw new TeamError("wrong_state", "The team treasury isn't ready")
  const relay = await submitRelaySignature(db, {
    ...input.approval,
    userId: input.userId,
    purposes: [`treasury-propose:${run.id}:`],
  })
  // The id the owner's own yes is cast on, read from the draft they signed: never one sent alongside it.
  const proposalId = draftedProposalId(relay.draft)
  if (proposalId === null) throw new TeamError("forbidden", "That approval is for something else")
  await db
    .update(payRuns)
    .set({
      status: "proposed",
      source: "treasury",
      treasuryId: t.id,
      proposalId,
      senderId: t.accountId,
      error: null,
    })
    .where(eq(payRuns.id, run.id))
  await db
    .insert(runVotes)
    .values({
      runId: run.id,
      userId: input.userId,
      accountId: t.approvers[0] ?? "",
      vote: "approve",
      relayId: relay.id,
    })
    .onConflictDoNothing()
  return relay.id
}

/** Whose vote this is on the run, or why they can't vote. */
async function voterOf(db: Db, run: typeof payRuns.$inferSelect, userId: string, t: Treasury) {
  const [ws] = await db
    .select({ ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.id, run.workspaceId))
  if (ws?.ownerId === userId) return t.approvers[0] ?? null
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.workspaceId, run.workspaceId),
        eq(teamMembers.network, run.network),
        eq(teamMembers.userId, userId),
        eq(teamMembers.status, "active"),
      ),
    )
  return member?.accountId && t.approvers.includes(member.accountId) ? member.accountId : null
}

/** An approver's yes or no, on exactly the proposal that pays the run's rows. */
export async function prepareVote(
  db: Db,
  input: { runId: string; userId: string; publicKey: string; vote: "approve" | "reject" },
) {
  if (!UUID.test(input.runId)) throw new TeamError("not_found", "No such run")
  const [run] = await db.select().from(payRuns).where(eq(payRuns.id, input.runId))
  if (!run?.treasuryId || run.proposalId === null)
    throw new TeamError("not_found", "No such approval")
  if (run.status !== "proposed")
    throw new TeamError("wrong_state", "This payroll isn't waiting for approval")
  const [t] = await db.select().from(treasuries).where(eq(treasuries.id, run.treasuryId))
  if (!t) throw new TeamError("not_found", "No such treasury")
  const voter = await voterOf(db, run, input.userId, t)
  if (!voter) throw new TeamError("forbidden", "You aren't an approver for this business")
  const [already] = await db
    .select()
    .from(runVotes)
    .where(and(eq(runVotes.runId, run.id), eq(runVotes.accountId, voter)))
  const proposal = await treasuryProposal(run.network, t.accountId, run.proposalId)
  if (!proposal) throw new TeamError("not_found", "The proposal isn't on NEAR")
  if (already || proposal.votes[voter])
    throw new TeamError("wrong_state", "You've voted on this one")
  if (proposal.status !== "InProgress")
    throw new TeamError("wrong_state", "This payroll is no longer open")
  // The proposal on chain must be exactly this run's rows: an approver never votes on something else.
  const rows = await runRows(db, run.id)
  if (!sameKind(proposal.kind, payrollKind(run.network, transfersOf(rows))))
    throw new TeamError("forbidden", "The proposal on NEAR doesn't match this payroll")
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, input.userId), eq(accounts.network, run.network)))
  if (account?.accountId !== voter)
    throw new TeamError("forbidden", "Vote from the account you joined with")
  const draft = await createRelayDraft(db, {
    userId: input.userId,
    network: run.network,
    purpose: `treasury-vote:${run.id}:${voter}:${crypto.randomUUID().slice(0, 8)}`,
    senderId: voter,
    receiverId: t.accountId,
    publicKey: input.publicKey,
    calls: [
      actProposal(
        run.proposalId,
        input.vote === "approve" ? "VoteApprove" : "VoteReject",
        proposal.kind as ProposalKind,
        rows.length,
        `tegata:run:${run.id.slice(0, 8)}`,
      ),
    ],
  })
  return {
    ...draft,
    proposalId: run.proposalId,
    treasury: t.accountId,
    usdc: NETWORKS[run.network].usdc,
    rows: rows.map((row) => ({
      id: row.id,
      accountId: row.accountId,
      amount: row.amount.toString(),
    })),
  }
}

export async function submitVote(
  db: Db,
  input: { runId: string; userId: string; vote: "approve" | "reject"; approval: Approval },
) {
  const relay = await submitRelaySignature(db, {
    ...input.approval,
    userId: input.userId,
    purposes: [`treasury-vote:${input.runId}:`],
  })
  const voter = relay.purpose.split(":")[2] ?? ""
  // The tally records what was signed, not what the request says was signed.
  const action = draftedAction(relay.draft)
  const vote =
    action === "VoteReject" ? "reject" : action === "VoteApprove" ? "approve" : input.vote
  await db
    .insert(runVotes)
    .values({
      runId: input.runId,
      userId: input.userId,
      accountId: voter,
      vote,
      relayId: relay.id,
    })
    .onConflictDoNothing()
  return relay.id
}

/**
 * Bring a run in line with its proposal on NEAR. Approved with the paying transaction known: rows are paid from the
 * treasury's USDC events (memo per row), then the run closes as any run does. Failed: the batch didn't land, nothing
 * moved. Rejected: declined. Past its period while still open: expired. Votes cast elsewhere (Trezu) are recorded.
 */
export async function syncTreasuryRun(
  db: Db,
  runId: string,
  operatorId: string,
  paidIn?: { txHash: string },
): Promise<"paid" | "failed" | "declined" | "expired" | "pending" | "ignored"> {
  const [run] = await db.select().from(payRuns).where(eq(payRuns.id, runId))
  if (!run?.treasuryId || run.proposalId === null) return "ignored"
  if (run.status !== "proposed" && run.status !== "approved") return "ignored"
  const [t] = await db.select().from(treasuries).where(eq(treasuries.id, run.treasuryId))
  if (!t) return "ignored"
  const proposal = await treasuryProposal(run.network, t.accountId, run.proposalId)
  if (!proposal) return "pending"
  for (const [account, vote] of Object.entries(proposal.votes)) {
    if (vote !== "Approve" && vote !== "Reject") continue
    await db
      .insert(runVotes)
      .values({
        runId: run.id,
        accountId: account,
        vote: vote === "Approve" ? "approve" : "reject",
      })
      .onConflictDoNothing()
  }
  if (proposal.status === "Approved" && paidIn) {
    const read = await readUsdcTransfers(run.network, paidIn.txHash, operatorId)
    if (read.state === "pending") return "pending"
    const fromTreasury = read.transfers.filter((transfer) => transfer.from === t.accountId)
    const rows = await runRows(db, run.id)
    await db
      .update(payRuns)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(payRuns.id, run.id))
    for (const row of rows) {
      const hit =
        row.accountId &&
        matchingTransfer(fromTreasury, {
          to: row.accountId,
          amount: row.amount,
          memo: payrollMemo(row.id),
        })
      await db
        .update(payRows)
        .set(
          hit
            ? { status: "paid", txHash: paidIn.txHash, paidAt: new Date() }
            : { status: "failed" },
        )
        .where(eq(payRows.id, row.id))
      if (hit && row.destinationKind === "tegata" && row.accountId)
        await applySplitToAccount(db, {
          accountId: row.accountId,
          network: run.network,
          amount: row.amount,
          sourceType: "payslip",
          sourceId: row.id,
        })
    }
    const closed = await closeRun(db, run.id)
    return closed === "paid" || closed === "failed" ? closed : "pending"
  }
  if (proposal.status === "Failed") {
    await db
      .update(payRuns)
      .set({ status: "failed", error: "The treasury's batch didn't land, so nothing moved." })
      .where(eq(payRuns.id, run.id))
    return "failed"
  }
  if (proposal.status === "Rejected" || proposal.status === "Removed") {
    await db.update(payRuns).set({ status: "declined" }).where(eq(payRuns.id, run.id))
    return "declined"
  }
  const endsMs =
    Number(BigInt(proposal.submission_time) / NS_PER_MS) + Number(TREASURY.periodNs / NS_PER_MS)
  if (proposal.status === "Expired" || (proposal.status === "InProgress" && Date.now() > endsMs)) {
    await db.update(payRuns).set({ status: "expired" }).where(eq(payRuns.id, run.id))
    return "expired"
  }
  return "pending"
}

/** Declined or expired: the same rows go back to review, to be sent again as a fresh proposal. */
export async function reopenTreasuryRun(db: Db, workspaceId: string, runId: string) {
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, runId), eq(payRuns.workspaceId, workspaceId)))
  if (!run || !["declined", "expired", "failed"].includes(run.status) || run.source !== "treasury")
    throw new TeamError("wrong_state", "This run can't be sent again")
  // A fresh proposal for the same rows is safe only once the last one can't pay: a Failed batch can be finalized
  // again, and an open one approved, until the treasury's voting period ends by NEAR's clock. Read it there.
  const [t] = run.treasuryId
    ? await db.select().from(treasuries).where(eq(treasuries.id, run.treasuryId))
    : []
  if (t && run.proposalId !== null) {
    const [proposal, policy] = await Promise.all([
      treasuryProposal(run.network, t.accountId, run.proposalId),
      treasuryPolicy(run.network, t.accountId),
    ])
    if (!proposal)
      throw new TeamError("wrong_state", "NEAR couldn't be read just now. Try again in a minute.")
    if (proposal.status === "Approved")
      throw new TeamError(
        "wrong_state",
        "The treasury approved this run on NEAR, so it can't be sent again",
      )
    if (!["Rejected", "Removed", "Expired"].includes(proposal.status)) {
      const periodNs = BigInt(policy?.proposal_period ?? TREASURY.periodNs)
      const ends =
        Number((BigInt(proposal.submission_time) + periodNs) / NS_PER_MS) + CLOCK_MARGIN_MS
      if (Date.now() < ends)
        throw new TeamError(
          "wrong_state",
          `Its proposal on NEAR could still pay until ${new Date(ends).toISOString().slice(0, 16).replace("T", " ")} UTC. Send it again after that.`,
        )
    }
  }
  await db.delete(runVotes).where(eq(runVotes.runId, run.id))
  await db
    .update(payRuns)
    .set({ status: "draft", attempt: run.attempt + 1, proposalId: null, error: null })
    .where(eq(payRuns.id, run.id))
  await db
    .update(payRows)
    .set({ status: "included" })
    .where(and(eq(payRows.runId, run.id), eq(payRows.status, "failed")))
}

/**
 * Worker, after a treasury relay lands: the seal makes the treasury ready (checked on chain); a proposal's failure
 * sends the run back to review; a vote syncs the run (the final one pays it).
 */
export async function settleTreasuryRelay(db: Db, relayId: string, operatorId: string) {
  const [relay] = await db.select().from(relays).where(eq(relays.id, relayId))
  if (!relay?.purpose.startsWith("treasury-")) return null
  const [kind, id] = relay.purpose.split(":")
  if (kind === "treasury-seal" && id) {
    if (relay.status !== "success") {
      await db
        .update(treasuries)
        .set({ error: relay.error ?? "The seal didn't go through. Hold to seal again." })
        .where(eq(treasuries.id, id))
      return "seal-failed"
    }
    const [t] = await db.select().from(treasuries).where(eq(treasuries.id, id))
    if (!t) return null
    const [info, policy] = await Promise.all([
      treasuryFactoryInfo(t.network, t.accountId),
      treasuryPolicy(t.network, t.accountId),
    ])
    const sealed =
      info?.auto_update === false && !policy?.roles.some((role) => role.name === "Admin")
    await db
      .update(treasuries)
      .set(
        sealed
          ? { status: "ready", sealRelayId: relay.id, error: null }
          : { error: "The seal didn't take. Hold to seal again." },
      )
      .where(eq(treasuries.id, t.id))
    return sealed ? "ready" : "seal-failed"
  }
  if (kind === "treasury-propose" && id) {
    if (relay.status === "failed" || relay.status === "expired") {
      // "Expired" means the outcome was never seen, so the proposal may have landed after all: look on NEAR
      // before sending the run back, or a second proposal for the same rows could pay them twice.
      const [run] = await db.select().from(payRuns).where(eq(payRuns.id, id))
      const [t] = run?.treasuryId
        ? await db.select().from(treasuries).where(eq(treasuries.id, run.treasuryId))
        : []
      const drafted = draftedProposalId(relay.draft)
      const landed =
        run && t && drafted !== null
          ? await treasuryProposal(run.network, t.accountId, drafted)
          : null
      if (
        run &&
        landed &&
        sameKind(landed.kind, payrollKind(run.network, transfersOf(await runRows(db, run.id))))
      ) {
        await db.update(payRuns).set({ proposalId: drafted, error: null }).where(eq(payRuns.id, id))
        return syncTreasuryRun(db, id, operatorId)
      }
      await db.delete(runVotes).where(eq(runVotes.runId, id))
      await db
        .update(payRuns)
        .set({
          status: "draft",
          proposalId: null,
          error: relay.error ?? "The treasury didn't take the payroll. Nothing moved.",
        })
        .where(eq(payRuns.id, id))
      return "proposal-failed"
    }
    return relay.status === "success" ? syncTreasuryRun(db, id, operatorId) : "pending"
  }
  if (kind === "treasury-vote" && id) {
    if (relay.status === "failed" || relay.status === "expired") {
      await db.delete(runVotes).where(eq(runVotes.relayId, relay.id))
      return "vote-failed"
    }
    if (relay.status !== "success" || !relay.txHash) return "pending"
    await db.update(runVotes).set({ txHash: relay.txHash }).where(eq(runVotes.relayId, relay.id))
    return syncTreasuryRun(db, id, operatorId, { txHash: relay.txHash })
  }
  return null
}

/** Worker, every minute: open treasury payrolls read from NEAR (votes in Trezu, declines, expiry). */
export async function syncTreasuryRuns(db: Db, network: NetworkId, operatorId: string) {
  const open = await db
    .select({ id: payRuns.id })
    .from(payRuns)
    .where(and(eq(payRuns.network, network), eq(payRuns.status, "proposed")))
  const out: { id: string; state: string }[] = []
  for (const run of open)
    out.push({ id: run.id, state: await syncTreasuryRun(db, run.id, operatorId) })
  return out
}

/** Treasuries waiting to be created (the worker's start-up sweep). */
export function treasuriesToCreate(db: Db) {
  return db.select().from(treasuries).where(eq(treasuries.status, "creating"))
}

// --- approvals -------------------------------------------------------------------------------------------------

/** Payrolls waiting on this person's vote (or sent by them), across every business they approve for. */
export async function approvalsFor(db: Db, userId: string, network: NetworkId) {
  const memberships = await db
    .select({ workspaceId: teamMembers.workspaceId, accountId: teamMembers.accountId })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.network, network),
        eq(teamMembers.status, "active"),
      ),
    )
  const owned = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
  const workspaceIds = [
    ...new Set([...memberships.map((m) => m.workspaceId), ...owned.map((w) => w.id)]),
  ]
  if (!workspaceIds.length) return []
  const runs = await db
    .select({ run: payRuns, treasury: treasuries, ...BUSINESS_HEADER, ownerId: workspaces.ownerId })
    .from(payRuns)
    .innerJoin(treasuries, eq(treasuries.id, payRuns.treasuryId))
    .innerJoin(workspaces, eq(workspaces.id, payRuns.workspaceId))
    .where(
      and(
        inArray(payRuns.workspaceId, workspaceIds),
        eq(payRuns.network, network),
        eq(payRuns.source, "treasury"),
        inArray(payRuns.status, ["proposed", "approved", "paid", "declined", "expired", "failed"]),
      ),
    )
    .orderBy(desc(payRuns.updatedAt))
    .limit(30)
  const votes = runs.length
    ? await db
        .select()
        .from(runVotes)
        .where(
          inArray(
            runVotes.runId,
            runs.map((r) => r.run.id),
          ),
        )
    : []
  return runs.map(({ run, treasury, ownerId, ...header }) => {
    const mine = ownerId === userId
    const myAccount = mine
      ? treasury.approvers[0]
      : memberships.find((m) => m.workspaceId === run.workspaceId)?.accountId
    const runVotesOf = votes.filter((v) => v.runId === run.id)
    return {
      runId: run.id,
      business: header.business,
      logo: headerLogo(header),
      label: periodLabel({ from: run.periodFrom, to: run.periodTo }),
      total: run.total,
      status: run.status,
      threshold: treasury.threshold,
      approvers: treasury.approvers.length,
      approvals: runVotesOf.filter((v) => v.vote === "approve").length,
      myVote: runVotesOf.find((v) => v.accountId === myAccount)?.vote ?? null,
      mine,
      updatedAt: run.updatedAt,
    }
  })
}

/** One payroll for an approver: its rows (read only), who voted, the treasury and the proposal. */
export async function approvalDetail(db: Db, userId: string, runId: string) {
  if (!UUID.test(runId)) return null
  const [row] = await db
    .select({ run: payRuns, treasury: treasuries, ...BUSINESS_HEADER, ownerId: workspaces.ownerId })
    .from(payRuns)
    .innerJoin(treasuries, eq(treasuries.id, payRuns.treasuryId))
    .innerJoin(workspaces, eq(workspaces.id, payRuns.workspaceId))
    .where(eq(payRuns.id, runId))
  if (!row) return null
  const voter = await voterOf(db, row.run, userId, row.treasury)
  if (!voter) return null
  const [rows, votes, members] = await Promise.all([
    db
      .select()
      .from(payRows)
      .where(eq(payRows.runId, runId))
      .orderBy(asc(payRows.name), asc(payRows.id)),
    db.select().from(runVotes).where(eq(runVotes.runId, runId)),
    db
      .select({ accountId: teamMembers.accountId, name: teamMembers.name })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.workspaceId, row.run.workspaceId),
          eq(teamMembers.network, row.run.network),
        ),
      ),
  ])
  const nameOf = (account: string) =>
    account === row.treasury.approvers[0]
      ? row.business
      : (members.find((m) => m.accountId === account)?.name ?? account)
  return {
    run: row.run,
    treasury: row.treasury,
    business: row.business,
    logo: headerLogo(row),
    label: periodLabel({ from: row.run.periodFrom, to: row.run.periodTo }),
    rows,
    me: voter,
    approvers: row.treasury.approvers.map((account) => ({
      account,
      name: nameOf(account),
      owner: account === row.treasury.approvers[0],
      vote: votes.find((v) => v.accountId === account)?.vote ?? null,
      at: votes.find((v) => v.accountId === account)?.createdAt ?? null,
    })),
  }
}
