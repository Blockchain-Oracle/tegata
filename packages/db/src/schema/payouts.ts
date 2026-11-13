// Money out to another chain through NEAR Intents 1Click (plan 6.8 AB): Send, a payroll row, a refund to the payer's
// chain, or Move out. The business pays exactly `amount` of USDC (EXACT_INPUT); the person receives what the quote
// says on their chain.
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { createdAt, id, money, updatedAt } from "./columns.ts"
import { network, relays, users, workspaces } from "./identity.ts"

export const payoutKind = pgEnum("payout_kind", ["send", "payroll", "refund", "move_out"])
export const payoutStatus = pgEnum("payout_status", [
  /** Quoted; waiting for the business to approve the transfer. */
  "drafted",
  /** Approved; the USDC is on its way to the deposit address. */
  "sending",
  /** On NEAR Intents, converting and crossing. */
  "processing",
  "delivered",
  /** 1Click returned the USDC to the business. */
  "refunded",
  "failed",
])

export const payouts = pgTable(
  "payouts",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    network: network().notNull(),
    kind: payoutKind().notNull(),
    /** The business's NEAR account the USDC leaves from. */
    senderId: text().notNull(),
    /** USDC base units the business sends (exactly). */
    amount: money().notNull(),
    /** Where it lands: a 1Click asset, its symbol and chain for people, and the address there. */
    destinationAsset: text().notNull(),
    symbol: text().notNull(),
    chain: text().notNull(),
    recipient: text().notNull(),
    /** What the quote said arrives, in the destination coin. */
    amountOutFormatted: text(),
    /** The signed quote and its deposit address on NEAR (a fresh implicit account). */
    quote: jsonb(),
    depositAddress: text(),
    deadline: timestamp({ withTimezone: true }),
    relayId: uuid().references(() => relays.id),
    status: payoutStatus().notNull().default("drafted"),
    swapStatus: text(),
    /** The NEAR transfer to the deposit address, and the delivery on the other chain. */
    txHash: text(),
    destinationTx: text(),
    error: text(),
    /** What this payout is for: a pay row, a payment being refunded. */
    reference: text(),
    deliveredAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("payouts_workspace_idx").on(table.workspaceId, table.createdAt),
    index("payouts_status_idx").on(table.status),
  ],
)
