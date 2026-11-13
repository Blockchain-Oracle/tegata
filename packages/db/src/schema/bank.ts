// Bank payouts and bank details through Noah (plan 6.8 AC). Per network like everything else: the Sandbox runs on
// Noah's sandbox, Live on Noah's production once its business review is done.
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
import { network, relays, users, workspaces } from "./identity.ts"

/** The business's customer record at Noah (one per user and network). */
export const bankCustomers = pgTable(
  "bank_customers",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    network: network().notNull(),
    /** Our id for them at Noah. */
    noahCustomerId: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("bank_customers_user_idx").on(table.userId, table.network)],
)

/** A saved bank account to pay out to: the bank's own form as Noah asked for it, and a masked label. */
export const bankPayoutAccounts = pgTable(
  "bank_payout_accounts",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    country: text().notNull(),
    fiat: text().notNull(),
    /** e.g. "Access Bank ••3456". */
    label: text().notNull(),
    /** Who holds the account: the bank's own answer in Nigeria (Noah's beneficiary check), the form elsewhere. */
    holder: text(),
    form: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("bank_payout_accounts_workspace_idx").on(table.workspaceId, table.network)],
)

/**
 * drafted: quoted, waiting for approval · sending: the USDC is leaving NEAR · converting: on its way to Noah (NEAR
 * Intents in Live, Tegata's test wallet on Solana devnet in the Sandbox) · paying: Noah has it and pays the bank ·
 * paid · failed.
 */
export const bankPayoutStatus = pgEnum("bank_payout_status", [
  "drafted",
  "sending",
  "converting",
  "paying",
  "paid",
  "failed",
])

export const bankPayouts = pgTable(
  "bank_payouts",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    network: network().notNull(),
    payoutAccountId: uuid()
      .notNull()
      .references(() => bankPayoutAccounts.id),
    /** USDC base units leaving the balance. */
    amount: money().notNull(),
    fiat: text().notNull(),
    /** What the bank account receives, as Noah quoted it (fiat, after Noah's fee). */
    fiatAmount: text().notNull(),
    rate: text().notNull(),
    fee: text().notNull(),
    channelId: text().notNull(),
    formSessionId: text(),
    /** Noah's payout rule and the address it watches for the deposit. */
    ruleId: text(),
    depositAddress: text(),
    relayId: uuid().references(() => relays.id),
    nearTx: text(),
    hopTx: text(),
    noahTxId: text(),
    status: bankPayoutStatus().notNull().default("drafted"),
    error: text(),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("bank_payouts_workspace_idx").on(table.workspaceId, table.createdAt),
    index("bank_payouts_status_idx").on(table.status),
  ],
)

/** Bank details for a business: a virtual account at Noah whose deposits arrive as USDC. */
export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    fiat: text().notNull(),
    virtualAccountId: text().notNull(),
    paymentMethodId: text().notNull(),
    /** Holder, number (IBAN or account), bank name and code, rail: what the card shows. */
    details: jsonb()
      .$type<{ holder: string; number: string; bank: string; code: string | null; rail: string }>()
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("bank_accounts_workspace_idx").on(table.workspaceId, table.network, table.fiat),
  ],
)

/** Money that arrived by bank transfer, credited to the business's USDC on NEAR once (keyed by Noah's transaction). */
export const bankDeposits = pgTable(
  "bank_deposits",
  {
    id: id(),
    noahTxId: text().notNull(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    fiatAmount: text().notNull(),
    fiat: text().notNull(),
    amount: money().notNull(),
    creditTx: text(),
    status: text().notNull().default("pending"),
    error: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("bank_deposits_noah_idx").on(table.noahTxId)],
)
