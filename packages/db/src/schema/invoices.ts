import {
  type AnyPgColumn,
  boolean,
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
import { network, workspaces } from "./identity.ts"
import { requests } from "./payments.ts"

/** Someone a business bills. Issued invoices keep their own snapshot, so editing a customer never rewrites one. */
export const customers = pgTable(
  "customers",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    email: text(),
    address: text(),
    taxId: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("customers_workspace_idx").on(table.workspaceId, table.name)],
)

/**
 * Stored status only. "Sent", "Viewed", "Partly paid" and "Overdue" are read from `sentAt`, `viewedAt`, the request's
 * paid total and the due date, so they can never go stale (plan 6.8 J–N).
 */
export const invoiceStatus = pgEnum("invoice_status", ["draft", "open", "paid", "void"])
export const discountKind = pgEnum("discount_kind", ["percent", "fixed"])
export const repeatCadence = pgEnum("repeat_cadence", ["weekly", "monthly"])

/** Who the invoice is from and to, frozen when it is sent. */
export interface PartySnapshot {
  name: string
  email: string | null
  address: string | null
  taxId: string | null
}

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    customerId: uuid().references(() => customers.id, { onDelete: "set null" }),
    /** The pay request behind the public link; created in the same transaction that sends the invoice. */
    requestId: uuid().references(() => requests.id),
    /** Given when sent, from the business's counter. Drafts have none. */
    number: integer(),
    status: invoiceStatus().notNull().default("draft"),
    issueDate: date({ mode: "string" }).notNull(),
    dueDate: date({ mode: "string" }).notNull(),
    notes: text(),
    discountKind: discountKind(),
    /** Basis points for a percent discount; base units for a fixed one. */
    discountValue: money(),
    taxBp: integer().notNull().default(0),
    subtotal: money().notNull(),
    discount: money().notNull(),
    tax: money().notNull(),
    total: money().notNull(),
    allowPartial: boolean().notNull().default(false),
    reminders: boolean().notNull().default(true),
    /** Chosen on the draft; becomes an `invoice_schedules` row when the invoice is sent. */
    repeat: repeatCadence(),
    billFrom: jsonb().$type<PartySnapshot>(),
    billTo: jsonb().$type<PartySnapshot>(),
    scheduleId: uuid().references((): AnyPgColumn => invoiceSchedules.id, { onDelete: "set null" }),
    sentAt: timestamp({ withTimezone: true }),
    viewedAt: timestamp({ withTimezone: true }),
    paidAt: timestamp({ withTimezone: true }),
    voidedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("invoices_number_idx").on(table.workspaceId, table.number),
    uniqueIndex("invoices_request_idx").on(table.requestId),
    index("invoices_workspace_idx").on(table.workspaceId, table.createdAt),
    index("invoices_status_idx").on(table.status, table.dueDate),
  ],
)

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: id(),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    description: text().notNull(),
    /** Quantity × 1000, so 1.5 hours is exact. */
    quantityMilli: money().notNull(),
    unitPrice: money().notNull(),
    amount: money().notNull(),
  },
  (table) => [index("invoice_lines_invoice_idx").on(table.invoiceId, table.position)],
)

export const invoiceEventKind = pgEnum("invoice_event_kind", [
  "created",
  "sent",
  "emailed",
  "email_failed",
  "viewed",
  "payment",
  "reminder",
  "marked_paid",
  "paid",
  "voided",
])

/** The invoice's timeline (plan R1): every change, in order. */
export const invoiceEvents = pgTable(
  "invoice_events",
  {
    id: id(),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    kind: invoiceEventKind().notNull(),
    detail: jsonb().$type<Record<string, string | number | null>>(),
    createdAt: createdAt(),
  },
  (table) => [index("invoice_events_invoice_idx").on(table.invoiceId, table.createdAt)],
)

/** A repeating invoice: the worker copies the template on each run, in the business's time zone. */
export const invoiceSchedules = pgTable(
  "invoice_schedules",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    templateId: uuid()
      .notNull()
      .references((): AnyPgColumn => invoices.id, { onDelete: "cascade" }),
    cadence: repeatCadence().notNull(),
    /** Days the copy is due after it is issued. */
    termsDays: integer().notNull().default(14),
    nextRunAt: timestamp({ withTimezone: true }).notNull(),
    lastRunAt: timestamp({ withTimezone: true }),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("invoice_schedules_due_idx").on(table.active, table.nextRunAt)],
)
