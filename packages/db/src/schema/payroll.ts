import { sql } from "drizzle-orm"
import {
  date,
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
import { network, relays, users, workspaces } from "./identity.ts"

export const personStatus = pgEnum("person_status", ["active", "removed"])

/**
 * Someone a business pays (plan 6.8 O). Kept per network, like Stripe's test mode keeps its own customers: a Sandbox
 * team never mixes with a Live one. The token opens the person's own page, where they choose where pay lands.
 */
export const people = pgTable(
  "people",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    name: text().notNull(),
    /** Lower-cased. Signing in with this email is what lets the person choose a destination. */
    email: text(),
    role: text(),
    /** Pay per run, in USDC base units. */
    amount: money().notNull(),
    /** The public, unguessable part of `/p/<token>`. */
    token: text().notNull(),
    /** The Tegata user who signed in with the invited email. */
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    status: personStatus().notNull().default("active"),
    invitedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("people_token_idx").on(table.token),
    uniqueIndex("people_email_idx").on(table.workspaceId, table.network, table.email),
    index("people_workspace_idx").on(table.workspaceId, table.network, table.status),
    index("people_user_idx").on(table.userId),
  ],
)

/** tegata: the person's own Tegata account on this network · near: a NEAR account they already have. */
export const destinationKind = pgEnum("destination_kind", ["tegata", "near"])
export const destinationSetBy = pgEnum("destination_set_by", ["person", "owner"])

/**
 * Where a person's pay lands, versioned: the newest row whose `activatesAt` has passed is the one a run uses. A change
 * the person makes waits 24 hours (the owner sees it coming); the first choice, and one the owner sets, apply at once.
 */
export const personDestinations = pgTable(
  "person_destinations",
  {
    id: id(),
    personId: uuid()
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    kind: destinationKind().notNull(),
    /** The NEAR account for `near`. Null for `tegata`: it is the person's account, read when a run is drafted. */
    accountId: text(),
    setBy: destinationSetBy().notNull(),
    activatesAt: timestamp({ withTimezone: true }).notNull(),
    /** For `near`: when the account could receive USDC (already registered, or registered by Tegata's operator). */
    readyAt: timestamp({ withTimezone: true }),
    /** The operator's registration transaction, when Tegata paid for it. */
    registeredTx: text(),
    error: text(),
    createdAt: createdAt(),
  },
  (table) => [index("person_destinations_person_idx").on(table.personId, table.createdAt)],
)

export const payCadence = pgEnum("pay_cadence", ["weekly", "fortnightly", "monthly"])

/**
 * The business's pay schedule on one network. Paydays are `firstPayday`, then each step of the cadence (monthly keeps
 * `anchorDay`, clamped to short months). The next one is the first payday after the last run, so nothing can drift.
 */
export const payrolls = pgTable(
  "payrolls",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    cadence: payCadence().notNull(),
    firstPayday: date().notNull(),
    anchorDay: integer().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("payrolls_workspace_idx").on(table.workspaceId, table.network)],
)

/**
 * The autopilot (plan 6.8 T): one plan per business and network on the `pay.tegata.*` contract. The row snapshot and
 * paydays are kept here; the money and the run state live in the contract and are read from it.
 * preparing: the operator is registering the business · ready: drafts can be signed · approved: signed, relaying ·
 * on: the plan exists on NEAR · off: cancelled · failed: the relays didn't land.
 */
export const autopilotStatus = pgEnum("autopilot_status", [
  "preparing",
  "ready",
  "approved",
  "on",
  "off",
  "failed",
])

export interface AutopilotRowSnapshot {
  personId: string
  name: string
  role: string | null
  destinationKind: "tegata" | "near"
  accountId: string
  /** USDC base units. */
  amount: string
}

export const autopilotPlans = pgTable(
  "autopilot_plans",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    status: autopilotStatus().notNull().default("preparing"),
    /** The contract's plan id, once `create_plan` has landed. */
    planId: text(),
    senderId: text().notNull(),
    paydays: jsonb().$type<string[]>().notNull(),
    dueMs: jsonb().$type<number[]>().notNull(),
    rows: jsonb().$type<AutopilotRowSnapshot[]>().notNull(),
    /** One payday's total, and what the owner chose to set aside now. */
    total: money().notNull(),
    setAside: money().notNull(),
    registerTx: text(),
    depositRelayId: uuid().references(() => relays.id),
    planRelayId: uuid().references(() => relays.id),
    /** The last run that couldn't be covered: what it needed and what was there. */
    underfunded: jsonb().$type<{ payday: string; needed: string; available: string; at: string }>(),
    error: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("autopilot_plans_workspace_idx").on(table.workspaceId, table.network, table.createdAt),
  ],
)

export const payRunSource = pgEnum("pay_run_source", ["approval", "autopilot"])

/** draft: being reviewed · approved: signed, on its way · paid: every included row landed · failed: nothing moved. */
export const payRunStatus = pgEnum("pay_run_status", ["draft", "approved", "paid", "failed"])

/** One payday's run. Rows are a snapshot taken when the run is drafted, so later edits never change a run. */
export const payRuns = pgTable(
  "pay_runs",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    payday: date().notNull(),
    periodFrom: date().notNull(),
    periodTo: date().notNull(),
    status: payRunStatus().notNull().default("draft"),
    /** Approved by the owner, or paid by the autopilot contract on its own. */
    source: payRunSource().notNull().default("approval"),
    autopilotId: uuid().references(() => autopilotPlans.id),
    /** The business's account the run pays from. */
    senderId: text().notNull(),
    /** Included rows, in USDC base units. */
    total: money().notNull().default(sql`0`),
    /** Each approval after a failure is a new attempt, so its relays get new purposes. */
    attempt: integer().notNull().default(1),
    txHashes: jsonb().$type<string[]>().notNull().default([]),
    error: text(),
    approvedAt: timestamp({ withTimezone: true }),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("pay_runs_payday_idx").on(table.workspaceId, table.network, table.payday),
    index("pay_runs_workspace_idx").on(table.workspaceId, table.network, table.createdAt),
  ],
)

/**
 * included / excluded: the owner's choice while reviewing · skipped: no destination ready (with the reason) ·
 * paid · failed: its batch didn't land, so nothing in that batch moved.
 */
export const payRowStatus = pgEnum("pay_row_status", [
  "included",
  "excluded",
  "skipped",
  "paid",
  "failed",
])

/** One person in one run. Its id is the payslip's address (`/r/slip/<id>`) and the transfer's memo. */
export const payRows = pgTable(
  "pay_rows",
  {
    id: id(),
    runId: uuid()
      .notNull()
      .references(() => payRuns.id, { onDelete: "cascade" }),
    personId: uuid()
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    name: text().notNull(),
    role: text(),
    destinationKind: destinationKind(),
    accountId: text(),
    amount: money().notNull(),
    status: payRowStatus().notNull(),
    skipReason: text(),
    /** Which all-or-nothing batch carried it (1-based), and that batch's relay. */
    batch: integer(),
    relayId: uuid().references(() => relays.id),
    txHash: text(),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("pay_rows_person_idx").on(table.runId, table.personId),
    index("pay_rows_relay_idx").on(table.relayId),
  ],
)
