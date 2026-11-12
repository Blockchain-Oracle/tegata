import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { createdAt, id, money, updatedAt } from "./columns.ts"
import { network, users } from "./identity.ts"

/** open: invited, not yet qualified · qualified: waiting out the hold · paid · void (with a reason). */
export const referralStatus = pgEnum("referral_status", ["open", "qualified", "paid", "void"])
export const referralSide = pgEnum("referral_side", ["referrer", "referee"])
export const referralPayoutStatus = pgEnum("referral_payout_status", ["queued", "sent", "failed"])

/**
 * One business invited by another (plan 6.8 H). A business has at most one referrer, and it is locked once the
 * business receives its first payment. The NEAR accounts of both sides are kept so the anti-abuse checks can tell
 * their money from a real customer's.
 */
export const referrals = pgTable(
  "referrals",
  {
    id: id(),
    network: network().notNull(),
    referrerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refereeId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referrerAccount: text().notNull(),
    refereeAccount: text().notNull(),
    status: referralStatus().notNull().default("open"),
    /** Received from payers who count, in USDC base units, as of the last check. */
    received: money().notNull(),
    /** The payer accounts whose payments counted: each can qualify one referral only. */
    qualifyingPayers: jsonb().$type<string[]>().notNull().default([]),
    /** Set when the business receives its first payment; the referrer can't change after that. */
    lockedAt: timestamp({ withTimezone: true }),
    qualifiedAt: timestamp({ withTimezone: true }),
    payoutAfter: timestamp({ withTimezone: true }),
    paidAt: timestamp({ withTimezone: true }),
    voidReason: text(),
    /** Something worth a human look (never blocks a reward). */
    flag: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("referrals_referee_idx").on(table.refereeId, table.network),
    index("referrals_referrer_idx").on(table.referrerId, table.createdAt),
    index("referrals_status_idx").on(table.status),
  ],
)

/** One reward transfer per side, sent by the operator; the hash is saved before broadcast (test-dollars pattern). */
export const referralPayouts = pgTable(
  "referral_payouts",
  {
    id: id(),
    referralId: uuid()
      .notNull()
      .references(() => referrals.id, { onDelete: "cascade" }),
    side: referralSide().notNull(),
    accountId: text().notNull(),
    amount: money().notNull(),
    status: referralPayoutStatus().notNull().default("queued"),
    txHash: text(),
    error: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("referral_payouts_side_idx").on(table.referralId, table.side)],
)
