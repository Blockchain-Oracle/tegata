import {
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

export const network = pgEnum("network", ["mainnet", "testnet"])

/** A person who signs in. `privyId` is null for people who signed in with a NEAR wallet. */
export const users = pgTable(
  "users",
  {
    id: id(),
    privyId: text().unique(),
    email: text(),
    /** `name` in `name.tegata.near`. Chosen once; the same on both networks. */
    handle: text().unique(),
    /** `ed25519:…` — the key that signs this person's actions. */
    publicKey: text(),
    /** Set for NEAR-wallet sign-in: the person's own account, used instead of a Tegata one. */
    walletAccountId: text(),
    /** The network that wallet account lives on (an implicit account's name alone doesn't say). */
    walletNetwork: network(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    uniqueIndex("users_wallet_account_idx").on(table.walletAccountId),
  ],
)

/**
 * A NEAR-wallet sign-in in progress: the 32-byte NEP-413 nonce the wallet must sign. Used once, and only before it
 * expires, so a signed message can't be replayed.
 */
export const signInChallenges = pgTable("sign_in_challenges", {
  id: id(),
  /** Base64 of the 32 random bytes. */
  nonce: text().notNull().unique(),
  network: network().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  usedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
})

/** A business. Every invoice, person, payroll and payment belongs to one. */
export const workspaces = pgTable("workspaces", {
  id: id(),
  ownerId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text().notNull(),
  /** IANA zone, e.g. `Africa/Lagos`. Schedules and due dates are in this zone. */
  timezone: text().notNull().default("UTC"),
  logoUrl: text(),
  address: text(),
  taxId: text(),
  email: text(),
  /** The next invoice and receipt numbers. Taken with one atomic UPDATE … RETURNING, so two at once never collide. */
  nextInvoiceNumber: integer().notNull().default(1),
  nextReceiptNumber: integer().notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/** A user's NEAR account on one network, and whether it is ready to hold dollars. */
export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    network: network().notNull(),
    accountId: text().notNull(),
    /** The operator's transaction that created the account. Null until created. */
    createdTx: text(),
    /** The operator's transaction that registered it on USDC. Null until registered. */
    registeredTx: text(),
    readyAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("accounts_user_network_idx").on(table.userId, table.network),
    uniqueIndex("accounts_network_account_idx").on(table.network, table.accountId),
  ],
)

export const relayStatus = pgEnum("relay_status", [
  "drafted",
  "signed",
  "sent",
  "success",
  "failed",
  "unknown",
  "expired",
])

/**
 * Every gas-free action the operator sponsors. The draft is stored when it is built, the
 * operator's transaction hash before the first broadcast, and the outcome when it is final.
 */
export const relays = pgTable(
  "relays",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    network: network().notNull(),
    /** What this relay is for, e.g. `send:<id>` or `run:<id>:1`. Unique, so a retry reuses the row. */
    purpose: text().notNull(),
    senderId: text().notNull(),
    receiverId: text().notNull(),
    /** The `DelegateDraft` the user signs. */
    draft: jsonb().notNull(),
    /** Base64 of the user's signature over the draft's hash. */
    signature: text(),
    status: relayStatus().notNull().default("drafted"),
    /** Operator transaction hash and signed bytes (base64), saved before broadcasting. */
    txHash: text(),
    txBytes: text(),
    error: text(),
    /** yoctoNEAR the operator burnt on gas. */
    tokensBurnt: money(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("relays_purpose_idx").on(table.purpose),
    index("relays_user_created_idx").on(table.userId, table.createdAt),
    index("relays_status_idx").on(table.status),
  ],
)
