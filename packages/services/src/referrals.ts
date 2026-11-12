import { NETWORKS, type NetworkId, REFERRALS } from "@tegata/config"
import type { DelegateDraft } from "@tegata/core/near"
import {
  ftTransfer,
  matchingTransfer,
  type Operator,
  readUsdcTransfers,
  toAction,
  tokenBalance,
} from "@tegata/core/near"
import { type Db, schema } from "@tegata/db"
import { and, asc, desc, eq, gte, inArray, isNull, like, lte, ne, sql } from "drizzle-orm"

const { referrals, referralPayouts, users, workspaces, accounts, payments, requests, relays } =
  schema

const DAY_MS = 86_400_000
const YEAR_MS = 365 * DAY_MS
/** A payout whose saved transaction NEAR still doesn't know after this long was never broadcast. */
const STALE_MS = 10 * 60_000

export const referralMemo = (id: string) => `tegata:referral:${id}`

export class ReferralError extends Error {
  constructor(
    readonly code: "not_found" | "self" | "locked" | "not_ready",
    message: string,
  ) {
    super(message)
  }
}

/** Lower case, without a "+tag": the same inbox can't refer itself under two addresses. */
const sameInbox = (email: string | null) =>
  email ? email.toLowerCase().replace(/\+[^@]*@/, "@") : null

/** The business behind a join link, for the landing page. */
export async function referrerByHandle(db: Db, handle: string) {
  const [row] = await db
    .select({ userId: users.id, handle: users.handle, business: workspaces.name })
    .from(users)
    .innerJoin(workspaces, eq(workspaces.ownerId, users.id))
    .where(eq(users.handle, handle.trim().toLowerCase()))
  return row
}

async function accountOf(db: Db, userId: string, network: NetworkId) {
  const [row] = await db
    .select({ accountId: accounts.accountId })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.network, network)))
  return row?.accountId
}

/** Record who referred a business. It can change until the business is first paid, then it is locked. */
export async function attachReferral(
  db: Db,
  input: { refereeId: string; handle: string; network: NetworkId },
) {
  const referrer = await referrerByHandle(db, input.handle)
  if (!referrer) throw new ReferralError("not_found", "No business uses that handle")
  if (referrer.userId === input.refereeId)
    throw new ReferralError("self", "You can't refer your own business")
  const [both] = await Promise.all([
    db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, [referrer.userId, input.refereeId])),
  ])
  const emails = both.map((u) => sameInbox(u.email))
  if (emails.length === 2 && emails[0] && emails[0] === emails[1])
    throw new ReferralError("self", "That business uses your own email")
  const [referrerAccount, refereeAccount] = await Promise.all([
    accountOf(db, referrer.userId, input.network),
    accountOf(db, input.refereeId, input.network),
  ])
  if (!referrerAccount || !refereeAccount)
    throw new ReferralError("not_ready", "Both businesses need an account first")

  const [existing] = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.refereeId, input.refereeId), eq(referrals.network, input.network)))
  if (existing) {
    if (existing.lockedAt || existing.status !== "open")
      throw new ReferralError("locked", "Your referrer is set once you've been paid")
    const [row] = await db
      .update(referrals)
      .set({ referrerId: referrer.userId, referrerAccount })
      .where(and(eq(referrals.id, existing.id), isNull(referrals.lockedAt)))
      .returning()
    return row
  }
  const [row] = await db
    .insert(referrals)
    .values({
      network: input.network,
      referrerId: referrer.userId,
      refereeId: input.refereeId,
      referrerAccount,
      refereeAccount,
      received: 0n,
    })
    .returning()
  return row
}

/** Take a referral off, while it is still allowed to change. */
export async function removeReferral(db: Db, refereeId: string, network: NetworkId) {
  const [row] = await db
    .delete(referrals)
    .where(
      and(
        eq(referrals.refereeId, refereeId),
        eq(referrals.network, network),
        isNull(referrals.lockedAt),
        eq(referrals.status, "open"),
      ),
    )
    .returning({ id: referrals.id })
  if (!row) throw new ReferralError("locked", "Your referrer is set once you've been paid")
}

type Referral = typeof referrals.$inferSelect

/**
 * What counts toward a referral: payments into the invited business since it joined, within the window, read from
 * NEAR (never "marked paid by hand"), from payers who are neither side, nor anyone either side sent money to, nor a
 * payer already counted for another referral.
 */
async function qualifying(db: Db, referral: Referral) {
  const rules = REFERRALS[referral.network]
  const windowEnd = new Date(referral.createdAt.getTime() + rules.windowDays * DAY_MS)
  const excluded = new Set([referral.referrerAccount, referral.refereeAccount])

  const [own, sent, used, business] = await Promise.all([
    db
      .select({ accountId: accounts.accountId })
      .from(accounts)
      .where(inArray(accounts.userId, [referral.referrerId, referral.refereeId])),
    db
      .select({ draft: relays.draft })
      .from(relays)
      .where(
        and(
          inArray(relays.userId, [referral.referrerId, referral.refereeId]),
          like(relays.purpose, "send:%"),
          eq(relays.status, "success"),
        ),
      ),
    db
      .select({ payers: referrals.qualifyingPayers })
      .from(referrals)
      .where(and(ne(referrals.id, referral.id), inArray(referrals.status, ["qualified", "paid"]))),
    db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerId, referral.refereeId)),
  ])
  for (const row of own) excluded.add(row.accountId)
  for (const row of sent) {
    const call = (row.draft as DelegateDraft).calls[0]
    if (call?.method !== "ft_transfer") continue
    const receiver = (JSON.parse(call.argsJson) as { receiver_id?: string }).receiver_id
    if (receiver) excluded.add(receiver)
  }
  for (const row of used) for (const payer of row.payers) excluded.add(payer)

  const workspaceId = business[0]?.id
  if (!workspaceId) return { total: 0n, payers: [] as string[], firstPaidAt: null as Date | null }
  const received = await db
    .select({
      amount: payments.amount,
      payer: payments.payer,
      rail: payments.rail,
      settledAt: payments.settledAt,
    })
    .from(payments)
    .innerJoin(requests, eq(requests.id, payments.requestId))
    .where(
      and(
        eq(requests.workspaceId, workspaceId),
        eq(payments.network, referral.network),
        eq(payments.status, "succeeded"),
        gte(payments.settledAt, referral.createdAt),
      ),
    )
    .orderBy(asc(payments.settledAt))

  let total = 0n
  const payers = new Set<string>()
  for (const p of received) {
    if (!p.settledAt || p.settledAt > windowEnd) continue
    if (p.rail === "manual" || !p.payer || excluded.has(p.payer)) continue
    total += p.amount
    payers.add(p.payer)
  }
  return { total, payers: [...payers], firstPaidAt: received[0]?.settledAt ?? null }
}

/** Move an open referral on: lock it at the first payment, qualify it at the threshold, or void it after the window. */
export async function checkReferral(db: Db, referral: Referral, now = new Date()) {
  if (referral.status !== "open") return referral.status
  const rules = REFERRALS[referral.network]
  const q = await qualifying(db, referral)
  const windowEnd = referral.createdAt.getTime() + rules.windowDays * DAY_MS
  const base = { received: q.total, lockedAt: referral.lockedAt ?? q.firstPaidAt }
  const next =
    q.total >= rules.threshold
      ? {
          ...base,
          status: "qualified" as const,
          qualifiedAt: now,
          payoutAfter: new Date(now.getTime() + rules.holdMs),
          qualifyingPayers: q.payers,
        }
      : now.getTime() > windowEnd
        ? {
            ...base,
            status: "void" as const,
            voidReason: `${rules.windowDays} days passed before it qualified`,
          }
        : base
  await db
    .update(referrals)
    .set(next)
    .where(and(eq(referrals.id, referral.id), eq(referrals.status, "open")))
  return "status" in next ? next.status : "open"
}

async function finishPayout(db: Db, id: string, status: "sent" | "failed", error?: string) {
  await db
    .update(referralPayouts)
    .set({ status, error: error ?? null })
    .where(eq(referralPayouts.id, id))
}

/** Send one side's reward. Safe to run again: a saved hash is checked on NEAR, never sent a second time. */
async function sendPayout(
  db: Db,
  operator: Operator,
  payout: typeof referralPayouts.$inferSelect,
  memo: string,
) {
  if (payout.status === "sent") return "sent"
  if (payout.txHash) {
    const read = await readUsdcTransfers(operator.network, payout.txHash, operator.accountId)
    if (read.state === "pending") {
      if (Date.now() - payout.updatedAt.getTime() > STALE_MS) {
        await db
          .update(referralPayouts)
          .set({ status: "queued", txHash: null })
          .where(eq(referralPayouts.id, payout.id))
      }
      return "queued"
    }
    const landed =
      read.ok &&
      matchingTransfer(read.transfers, { to: payout.accountId, amount: payout.amount, memo })
    await finishPayout(
      db,
      payout.id,
      landed ? "sent" : "failed",
      landed ? undefined : "The transfer didn't land",
    )
    return landed ? "sent" : "failed"
  }
  const usdc = NETWORKS[operator.network].usdc
  if ((await tokenBalance(operator.network, usdc, operator.accountId)) < payout.amount) {
    await finishPayout(
      db,
      payout.id,
      "failed",
      "The reward stash is empty; it will be sent once it is topped up",
    )
    return "failed"
  }
  const result = await operator.send(
    usdc,
    [toAction(ftTransfer(payout.accountId, payout.amount, memo))],
    async (tx) => {
      await db
        .update(referralPayouts)
        .set({ txHash: tx.hash })
        .where(eq(referralPayouts.id, payout.id))
    },
  )
  if (result.status === "unknown") return "queued"
  await finishPayout(db, payout.id, result.status === "success" ? "sent" : "failed", result.error)
  return result.status === "success" ? "sent" : "failed"
}

/** Pay a referral whose hold has passed: check it still qualifies and is within the yearly cap, then pay both sides. */
export async function payReferral(
  db: Db,
  operator: Operator,
  referral: Referral,
  now = new Date(),
) {
  if (referral.status !== "qualified" || !referral.payoutAfter || referral.payoutAfter > now)
    return referral.status
  const rules = REFERRALS[referral.network]
  const voidIt = async (reason: string) => {
    await db
      .update(referrals)
      .set({ status: "void", voidReason: reason })
      .where(and(eq(referrals.id, referral.id), eq(referrals.status, "qualified")))
    return "void" as const
  }
  const q = await qualifying(db, { ...referral, status: "open" })
  if (q.total < rules.threshold) return voidIt("A payment that qualified it was refunded")
  const [paidThisYear] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, referral.referrerId),
        eq(referrals.status, "paid"),
        gte(referrals.paidAt, new Date(now.getTime() - YEAR_MS)),
      ),
    )
  if ((paidThisYear?.n ?? 0) >= rules.yearlyCap)
    return voidIt(`The referrer has had ${rules.yearlyCap} rewards this year`)

  await db
    .insert(referralPayouts)
    .values([
      {
        referralId: referral.id,
        side: "referrer",
        accountId: referral.referrerAccount,
        amount: rules.reward,
      },
      {
        referralId: referral.id,
        side: "referee",
        accountId: referral.refereeAccount,
        amount: rules.reward,
      },
    ])
    .onConflictDoNothing()
  const payouts = await db
    .select()
    .from(referralPayouts)
    .where(eq(referralPayouts.referralId, referral.id))
  const results = []
  for (const payout of payouts)
    results.push(await sendPayout(db, operator, payout, referralMemo(referral.id)))
  if (results.length === 2 && results.every((r) => r === "sent")) {
    await db
      .update(referrals)
      .set({ status: "paid", paidAt: now })
      .where(and(eq(referrals.id, referral.id), eq(referrals.status, "qualified")))
    return "paid"
  }
  return "qualified"
}

/** The worker's sweep: qualify open referrals and pay those past their hold. Idempotent. */
export async function sweepReferrals(db: Db, operator: Operator, now = new Date()) {
  const open = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.network, operator.network), eq(referrals.status, "open")))
  for (const referral of open) await checkReferral(db, referral, now)
  const due = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.network, operator.network),
        eq(referrals.status, "qualified"),
        lte(referrals.payoutAfter, now),
      ),
    )
  const paid: string[] = []
  for (const referral of due) {
    if ((await payReferral(db, operator, referral, now)) === "paid") paid.push(referral.id)
  }
  return { checked: open.length, paid }
}

// --- reading ----------------------------------------------------------------------------------------------

/** The businesses a person invited, newest first, with progress and rewards. */
export async function listReferrals(db: Db, referrerId: string, network: NetworkId) {
  const rows = await db
    .select({ referral: referrals, business: workspaces.name, handle: users.handle })
    .from(referrals)
    .innerJoin(users, eq(users.id, referrals.refereeId))
    .leftJoin(workspaces, eq(workspaces.ownerId, referrals.refereeId))
    .where(and(eq(referrals.referrerId, referrerId), eq(referrals.network, network)))
    .orderBy(desc(referrals.createdAt))
  const ids = rows.map((r) => r.referral.id)
  const payouts = ids.length
    ? await db.select().from(referralPayouts).where(inArray(referralPayouts.referralId, ids))
    : []
  return rows.map(({ referral, business, handle }) => ({
    ...referral,
    business: business ?? handle ?? "A business",
    handle,
    payout: payouts.find((p) => p.referralId === referral.id && p.side === "referrer") ?? null,
  }))
}

/** Who referred this person, with progress (for their Home tile and the Refer page). */
export async function referredBy(db: Db, refereeId: string, network: NetworkId) {
  const [row] = await db
    .select({ referral: referrals, business: workspaces.name, handle: users.handle })
    .from(referrals)
    .innerJoin(users, eq(users.id, referrals.referrerId))
    .leftJoin(workspaces, eq(workspaces.ownerId, referrals.referrerId))
    .where(and(eq(referrals.refereeId, refereeId), eq(referrals.network, network)))
  if (!row) return null
  const [payout] = await db
    .select()
    .from(referralPayouts)
    .where(
      and(eq(referralPayouts.referralId, row.referral.id), eq(referralPayouts.side, "referee")),
    )
  return {
    ...row.referral,
    business: row.business ?? row.handle ?? "A business",
    handle: row.handle,
    payout: payout ?? null,
  }
}

/** Rewards that reached this person's accounts (for Activity). */
export async function rewardsFor(db: Db, userId: string) {
  return db
    .select({ payout: referralPayouts, network: referrals.network })
    .from(referralPayouts)
    .innerJoin(referrals, eq(referrals.id, referralPayouts.referralId))
    .innerJoin(accounts, eq(accounts.accountId, referralPayouts.accountId))
    .where(and(eq(accounts.userId, userId), eq(referralPayouts.status, "sent")))
    .orderBy(desc(referralPayouts.updatedAt))
}
