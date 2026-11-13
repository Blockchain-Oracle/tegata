// Split pots: the account holder's own percentages of every payment in, kept as labelled balances (Tax, Savings) on
// the one NEAR account. Labels, not separate accounts: nothing moves on chain to split, and nothing is custodial.
import { sql } from "drizzle-orm"
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { createdAt, id, money, updatedAt } from "./columns.ts"
import { network, workspaces } from "./identity.ts"

export const potKind = pgEnum("pot_kind", ["tax", "savings"])

/** The rule: what share of each payment in goes to each pot, per network. */
export const splitRules = pgTable(
  "split_rules",
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    on: boolean().notNull().default(false),
    /** Basis points of each payment (2500 = 25%). */
    taxBps: integer().notNull().default(0),
    savingsBps: integer().notNull().default(0),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.network] })],
)

export const pots = pgTable(
  "pots",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    kind: potKind().notNull(),
    balance: money().notNull().default(sql`0`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("pots_workspace_kind_idx").on(table.workspaceId, table.network, table.kind),
  ],
)

/** Every change to a pot: a split of a payment, a move by hand, or a shrink when the account holds less. */
export const potMoves = pgTable(
  "pot_moves",
  {
    id: id(),
    potId: uuid()
      .notNull()
      .references(() => pots.id, { onDelete: "cascade" }),
    /** Signed base units: + into the pot, − out of it. */
    amount: money().notNull(),
    reason: text().notNull(),
    /** What it came from ("payment", "payslip"), so a split happens once per payment. */
    sourceType: text(),
    sourceId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("pot_moves_source_idx")
      .on(table.potId, table.sourceType, table.sourceId)
      .where(sql`${table.sourceId} is not null`),
  ],
)
