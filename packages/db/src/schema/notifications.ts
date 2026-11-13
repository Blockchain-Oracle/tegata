// The email outbox (plan R1: every money movement gets an email). A row is written in the same transaction as the event
// it tells about, so an email can't be forgotten; the worker drains queued rows, renders them by kind and sends them
// through Resend with the row's id as the idempotency key, so a retry never sends twice.
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
import { workspaces } from "./identity.ts"

export const notificationStatus = pgEnum("notification_status", [
  "queued",
  "sending",
  "sent",
  "failed",
  "skipped",
])

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    /** What happened, e.g. `payment.received`; picks the template. */
    kind: text().notNull(),
    to: text().notNull(),
    /** The business it's about, for the owner's email preferences and its history. Null for Tegata's own emails. */
    workspaceId: uuid().references(() => workspaces.id, { onDelete: "cascade" }),
    /** Everything the template shows, captured when the event happened. */
    data: jsonb().notNull(),
    /** One email per event and recipient: a second queue of the same thing is ignored. */
    dedupe: text().notNull(),
    status: notificationStatus().notNull().default("queued"),
    attempts: integer().notNull().default(0),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Resend's id once sent. */
    providerId: text(),
    error: text(),
    sentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("notifications_dedupe_idx").on(table.dedupe),
    index("notifications_due_idx").on(table.status, table.nextAttemptAt),
    index("notifications_workspace_idx").on(table.workspaceId, table.createdAt),
  ],
)
