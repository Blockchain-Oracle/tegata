// Team approvals: the people who approve a business's payroll, the team treasury on NEAR (a Sputnik DAO whose policy
// needs k of them), and each approver's vote on a run. Per network, like people: a Sandbox team never mixes with Live.
import { sql } from "drizzle-orm"
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

import { createdAt, id, updatedAt } from "./columns.ts"
import { network, relays, users, workspaces } from "./identity.ts"
import { payRuns } from "./payroll.ts"

export const teamMemberStatus = pgEnum("team_member_status", ["invited", "active", "removed"])

/** Someone the owner asked to approve payroll. The owner is always an approver and has no row here. */
export const teamMembers = pgTable(
  "team_members",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    name: text().notNull(),
    /** Lower-cased. Signing in with it is what makes them this approver. */
    email: text().notNull(),
    /** The public part of `/team/<token>`, the page their invite opens. */
    token: text().notNull(),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    /** Their NEAR account on this network, the one in the treasury's policy. */
    accountId: text(),
    status: teamMemberStatus().notNull().default("invited"),
    invitedAt: timestamp({ withTimezone: true }),
    joinedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("team_members_token_idx").on(table.token),
    uniqueIndex("team_members_email_idx").on(table.workspaceId, table.network, table.email),
    index("team_members_user_idx").on(table.userId),
  ],
)

/** creating → sealing (the owner switches off code updates and locks the policy) → ready; failed with the reason. */
export const treasuryStatus = pgEnum("treasury_status", ["creating", "sealing", "ready", "failed"])

export const treasuries = pgTable(
  "treasuries",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    /** The DAO: `<handle>.sputnik-dao.near` on mainnet, `<handle>-team.tegata.testnet` on testnet. */
    accountId: text().notNull(),
    /** Approvals a payment needs (k), and every approver's account (n, the owner first). */
    threshold: integer().notNull(),
    approvers: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    status: treasuryStatus().notNull().default("creating"),
    createTx: text(),
    sealRelayId: uuid().references(() => relays.id),
    error: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("treasuries_workspace_idx").on(table.workspaceId, table.network),
    uniqueIndex("treasuries_account_idx").on(table.accountId),
  ],
)

/** One approver's vote on a run sent for approval (the owner's yes is filed with the proposal). */
export const runVotes = pgTable(
  "run_votes",
  {
    id: id(),
    runId: uuid()
      .notNull()
      .references(() => payRuns.id, { onDelete: "cascade" }),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    accountId: text().notNull(),
    vote: text().$type<"approve" | "reject">().notNull(),
    relayId: uuid().references(() => relays.id),
    txHash: text(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("run_votes_voter_idx").on(table.runId, table.accountId)],
)
