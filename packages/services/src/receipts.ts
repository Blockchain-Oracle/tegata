// Receipts for the money movements that aren't customer payments: a one-off send and a referral reward. A customer
// payment's receipt is numbered and lives in `receipts` (payments.ts, `receiptByToken`); these two are read straight
// from the relay or the payout. Both are public by their id, which is random (uuid v4), like a receipt token.
import { NETWORKS } from "@tegata/config"
import type { DelegateDraft } from "@tegata/core/near"
import { type Db, schema } from "@tegata/db"
import { and, eq, like } from "drizzle-orm"

import { BUSINESS_HEADER, headerLogo } from "./payments.ts"

const { relays, referrals, referralPayouts, workspaces, accounts } = schema

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A send that left the business: who sent what to whom, and the NEAR transaction. Undefined for a failed one. */
export async function sendReceipt(db: Db, id: string) {
  if (!UUID.test(id)) return undefined
  const [row] = await db
    .select({ relay: relays, ...BUSINESS_HEADER })
    .from(relays)
    .innerJoin(workspaces, eq(workspaces.ownerId, relays.userId))
    .where(and(eq(relays.id, id), like(relays.purpose, "send:%")))
  if (!row || ["drafted", "failed", "expired"].includes(row.relay.status)) return undefined
  const call = (row.relay.draft as DelegateDraft).calls[0]
  if (call?.method !== "ft_transfer") return undefined
  const args = JSON.parse(call.argsJson) as { receiver_id: string; amount: string }
  return {
    relay: row.relay,
    business: row.business,
    logo: headerLogo(row),
    to: args.receiver_id,
    amount: BigInt(args.amount),
    settled: row.relay.status === "success",
  }
}

/** A referral reward Tegata paid to one of the two businesses. Undefined until it has been sent. */
export async function rewardReceipt(db: Db, id: string) {
  if (!UUID.test(id)) return undefined
  const [row] = await db
    .select({ payout: referralPayouts, referral: referrals })
    .from(referralPayouts)
    .innerJoin(referrals, eq(referrals.id, referralPayouts.referralId))
    .where(eq(referralPayouts.id, id))
  if (row?.payout.status !== "sent") return undefined
  const otherId = row.payout.side === "referrer" ? row.referral.refereeId : row.referral.referrerId
  const [[receiver], [other]] = await Promise.all([
    db
      .select({ name: workspaces.name })
      .from(accounts)
      .innerJoin(workspaces, eq(workspaces.ownerId, accounts.userId))
      .where(eq(accounts.accountId, row.payout.accountId)),
    db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.ownerId, otherId)),
  ])
  return {
    payout: row.payout,
    network: row.referral.network,
    receiver: receiver?.name ?? row.payout.accountId,
    /** The other business in the referral: the one invited, or the one that invited. */
    other: other?.name ?? "a business",
    operator: NETWORKS[row.referral.network].operator,
  }
}
