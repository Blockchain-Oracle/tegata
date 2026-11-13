import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { createdAt, id, money, updatedAt } from "./columns.ts"
import { network, relays, workspaces } from "./identity.ts"

/** What a request is: a reusable pay link today; invoices and checkout sessions join later. */
export const requestKind = pgEnum("request_kind", ["link", "invoice", "session"])
export const requestStatus = pgEnum("request_status", ["open", "paid", "closed"])

/**
 * Something a business wants paid. One public token opens its pay page. A reusable link stays open after each
 * payment; a one-off request is paid once its succeeded attempts reach the amount.
 */
export const requests = pgTable(
  "requests",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    kind: requestKind().notNull(),
    /** The public, unguessable part of the pay URL. */
    token: text().notNull(),
    title: text().notNull(),
    note: text(),
    /** USDC base units. Null: the payer types the amount. */
    amount: money(),
    reusable: boolean().notNull().default(true),
    status: requestStatus().notNull().default("open"),
    /** The NEAR account that receives the money (the business's account on this network). */
    receiverId: text().notNull(),
    /** Checkout sessions (API): where the payer returns once paid, the developer's own data, and the key that made it. */
    successUrl: text(),
    metadata: jsonb().$type<Record<string, string>>(),
    apiKeyId: uuid(),
    idempotencyKey: text(),
    paidCount: integer().notNull().default(0),
    paidTotal: money().notNull().default(sql`0`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("requests_token_idx").on(table.token),
    uniqueIndex("requests_idempotency_idx").on(table.apiKeyId, table.idempotencyKey),
    index("requests_workspace_idx").on(table.workspaceId, table.createdAt),
  ],
)

/**
 * How a payer pays: from a Tegata balance (gas-free relay), a NEAR wallet, another chain via NEAR Intents, by hand, or
 * by bank card through Transak (USDC on NEAR to the business).
 */
export const paymentRail = pgEnum("payment_rail", [
  "tegata",
  "near_wallet",
  "oneclick",
  "manual",
  "card",
])

/** One attempt to pay a request (plan section 2, "Paying in"). Only succeeded attempts count. */
export const paymentStatus = pgEnum("payment_status", [
  "awaiting",
  "detected",
  "settling",
  "succeeded",
  "refunded",
  "failed",
  "expired",
])

export const payments = pgTable(
  "payments",
  {
    id: id(),
    requestId: uuid()
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    network: network().notNull(),
    rail: paymentRail().notNull(),
    status: paymentStatus().notNull().default("awaiting"),
    /** USDC base units the business must receive. */
    amount: money().notNull(),
    /** What the business has refunded to the payer so far (plan 6.8 X). */
    refunded: money().notNull().default(sql`0`),
    /** The transfer memo that ties an on-chain transfer to this attempt: `tegata:pay:<id>`. */
    memo: text().notNull(),
    receiverId: text().notNull(),
    /** Who paid, when known: a NEAR account, or the address on another chain. */
    payer: text(),
    payerEmail: text(),
    /** The NEAR transaction that moved the USDC to the business. */
    txHash: text(),
    /** For the Tegata rail: the relay that carries the transfer. */
    relayId: uuid().references(() => relays.id),
    /** For the 1Click rail: the stored, signed quote and its deposit address. */
    quote: jsonb(),
    depositAddress: text(),
    /** 1Click rail: where a refund goes (the payer's address on the chain they pay from). */
    refundTo: text(),
    /** 1Click rail: the coin paid in (a 1Click asset id) and what was asked, in its base units. */
    assetIn: text(),
    amountIn: text(),
    /** 1Click rail: the last status read from 1Click (PENDING_DEPOSIT … SUCCESS / REFUNDED / FAILED). */
    swapStatus: text(),
    /** 1Click rail: the payer's deposit transaction on their chain. */
    originTx: text(),
    /** Card rail: Transak's order id (its status is kept in `swapStatus`). */
    cardOrderId: text(),
    deadline: timestamp({ withTimezone: true }),
    error: text(),
    settledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("payments_request_idx").on(table.requestId, table.createdAt),
    index("payments_status_idx").on(table.status),
    uniqueIndex("payments_tx_idx").on(table.network, table.txHash),
  ],
)

/** One receipt per succeeded payment, numbered per business, with a public token. */
export const receipts = pgTable(
  "receipts",
  {
    id: id(),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    token: text().notNull(),
    number: integer().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("receipts_payment_idx").on(table.paymentId),
    uniqueIndex("receipts_token_idx").on(table.token),
    uniqueIndex("receipts_number_idx").on(table.workspaceId, table.number),
  ],
)
