import type { NetworkId } from "@tegata/config"
import {
  addDays,
  atLocal,
  type Cadence,
  CENT,
  type Discount,
  daysBetween,
  INVOICE_LIMITS,
  invoiceNumber,
  invoiceTotals,
  localToday,
  nextRun,
  percentText,
  quantityText,
  RUN_HOUR,
} from "@tegata/core/invoices"
import { formatUsd } from "@tegata/core/money"
import { type Db, schema } from "@tegata/db"
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm"

import { businessLogo } from "./business.ts"
import { applyPayment, publicToken, type Tx } from "./payments.ts"

const {
  invoices,
  invoiceLines,
  invoiceEvents,
  invoiceSchedules,
  customers,
  requests,
  payments,
  receipts,
  workspaces,
  accounts,
} = schema

/** A connection or a transaction: invoice steps run inside a caller's transaction when it has one. */
type Conn = Db | Tx

const LINK_TOKEN_LENGTH = 12
const MAX_TOTAL = 1_000_000n * 100n * CENT
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** Reminders: days relative to the due date. */
const REMINDER_DAYS = [-3, 0, 3, 7] as const

export class InvoiceError extends Error {
  constructor(
    readonly code: "not_found" | "invalid" | "wrong_state" | "not_ready",
    message: string,
    readonly field?: string,
  ) {
    super(message)
  }
}

export interface LineInput {
  description: string
  quantityMilli: bigint
  unitPrice: bigint
}

export interface DraftInput {
  customerId: string | null
  issueDate: string
  dueDate: string
  notes: string | null
  discount: Discount
  taxBp: number
  allowPartial: boolean
  reminders: boolean
  repeat: Cadence | null
  lines: LineInput[]
}

export type DisplayStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partly_paid"
  | "overdue"
  | "paid"
  | "void"

/** Sent, Viewed, Partly paid and Overdue are read, never stored, so they can't go stale. */
export function displayStatus(
  invoice: { status: string; dueDate: string; viewedAt: Date | null },
  paidTotal: bigint,
  today: string,
): DisplayStatus {
  if (invoice.status === "draft" || invoice.status === "void" || invoice.status === "paid")
    return invoice.status
  if (invoice.dueDate < today) return "overdue"
  if (paidTotal > 0n) return "partly_paid"
  return invoice.viewedAt ? "viewed" : "sent"
}

function check(input: DraftInput, forSend: boolean) {
  if (!ISO_DATE.test(input.issueDate) || !ISO_DATE.test(input.dueDate))
    throw new InvoiceError("invalid", "Pick the dates", "dates")
  if (input.dueDate < input.issueDate)
    throw new InvoiceError("invalid", "The due date can't be before the issue date", "dates")
  if (input.lines.length > INVOICE_LIMITS.lines)
    throw new InvoiceError("invalid", `Up to ${INVOICE_LIMITS.lines} items`, "lines")
  if ((input.notes ?? "").length > INVOICE_LIMITS.notes)
    throw new InvoiceError("invalid", "Keep notes under 1,000 characters", "notes")
  if (input.taxBp < 0 || input.taxBp > INVOICE_LIMITS.maxTaxBp)
    throw new InvoiceError("invalid", "Tax is between 0 and 100%", "tax")
  if (input.discount?.kind === "fixed" && input.discount.amount % CENT !== 0n)
    throw new InvoiceError("invalid", "Discount is in whole cents", "discount")
  for (const line of input.lines) {
    if (line.description.trim().length > INVOICE_LIMITS.description)
      throw new InvoiceError("invalid", "Keep each item under 200 characters", "lines")
    if (line.quantityMilli <= 0n || line.quantityMilli > INVOICE_LIMITS.maxQuantityMilli)
      throw new InvoiceError("invalid", "Each quantity is more than zero", "lines")
    if (
      line.unitPrice < 0n ||
      line.unitPrice % CENT !== 0n ||
      line.unitPrice > INVOICE_LIMITS.maxUnitPrice
    )
      throw new InvoiceError("invalid", "Prices are in dollars and cents", "lines")
  }
  const totals = invoiceTotals(input.lines, input.discount, input.taxBp)
  if (forSend) {
    if (!input.customerId)
      throw new InvoiceError("invalid", "Choose who you're billing", "customer")
    if (input.lines.length === 0)
      throw new InvoiceError("invalid", "Add at least one item", "lines")
    if (input.lines.some((line) => !line.description.trim()))
      throw new InvoiceError("invalid", "Every item needs a description", "lines")
    if (totals.total < CENT)
      throw new InvoiceError("invalid", "The total must be at least $0.01", "total")
    if (totals.total > MAX_TOTAL)
      throw new InvoiceError("invalid", "The total must be under $1,000,000", "total")
  }
  return totals
}

function draftValues(input: DraftInput) {
  const totals = check(input, false)
  return {
    totals,
    values: {
      customerId: input.customerId,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      notes: input.notes?.trim() || null,
      discountKind: input.discount?.kind ?? null,
      discountValue:
        input.discount === null
          ? null
          : input.discount.kind === "percent"
            ? BigInt(input.discount.bp)
            : input.discount.amount,
      taxBp: input.taxBp,
      allowPartial: input.allowPartial,
      reminders: input.reminders,
      repeat: input.repeat,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
    },
  }
}

async function writeLines(conn: Conn, invoiceId: string, input: DraftInput, amounts: bigint[]) {
  await conn.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId))
  if (input.lines.length === 0) return
  await conn.insert(invoiceLines).values(
    input.lines.map((line, position) => ({
      invoiceId,
      position,
      description: line.description.trim(),
      quantityMilli: line.quantityMilli,
      unitPrice: line.unitPrice,
      amount: amounts[position] ?? 0n,
    })),
  )
}

async function ownCustomer(conn: Conn, workspaceId: string, customerId: string | null) {
  if (!customerId) return
  const [row] = await conn
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.workspaceId, workspaceId)))
  if (!row) throw new InvoiceError("invalid", "That customer isn't yours", "customer")
}

// --- drafts ------------------------------------------------------------------------------------------------

export async function createDraft(
  db: Db,
  scope: { workspaceId: string; network: NetworkId },
  input: DraftInput,
) {
  await ownCustomer(db, scope.workspaceId, input.customerId)
  const { totals, values } = draftValues(input)
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(invoices)
      .values({ ...values, workspaceId: scope.workspaceId, network: scope.network })
      .returning()
    if (!row) throw new Error("Could not create the invoice")
    await writeLines(tx, row.id, input, totals.lines)
    await tx.insert(invoiceEvents).values({ invoiceId: row.id, kind: "created" })
    return row
  })
}

export async function updateDraft(db: Db, workspaceId: string, id: string, input: DraftInput) {
  await ownCustomer(db, workspaceId, input.customerId)
  const { totals, values } = draftValues(input)
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(invoices)
      .set(values)
      .where(
        and(
          eq(invoices.id, id),
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.status, "draft"),
        ),
      )
      .returning()
    if (!row) throw new InvoiceError("wrong_state", "Only drafts can be edited")
    await writeLines(tx, row.id, input, totals.lines)
    return row
  })
}

export async function deleteDraft(db: Db, workspaceId: string, id: string) {
  const [row] = await db
    .delete(invoices)
    .where(
      and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId), eq(invoices.status, "draft")),
    )
    .returning({ id: invoices.id })
  if (!row) throw new InvoiceError("wrong_state", "Only drafts can be deleted")
}

/** The draft as the builder edits it. */
async function draftInputOf(
  conn: Conn,
  invoice: typeof invoices.$inferSelect,
): Promise<DraftInput> {
  const lines = await conn
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoice.id))
    .orderBy(asc(invoiceLines.position))
  return {
    customerId: invoice.customerId,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    discount:
      invoice.discountKind === "percent"
        ? { kind: "percent", bp: Number(invoice.discountValue ?? 0n) }
        : invoice.discountKind === "fixed"
          ? { kind: "fixed", amount: invoice.discountValue ?? 0n }
          : null,
    taxBp: invoice.taxBp,
    allowPartial: invoice.allowPartial,
    reminders: invoice.reminders,
    repeat: invoice.repeat,
    lines: lines.map((line) => ({
      description: line.description,
      quantityMilli: line.quantityMilli,
      unitPrice: line.unitPrice,
    })),
  }
}

// --- sending ----------------------------------------------------------------------------------------------

/**
 * Send a draft. In one transaction: check it is complete, take the business's next number (an atomic counter, so
 * two sends never share one), freeze who it is from and to, create the pay request behind its public link, and
 * start its repeat schedule. Nothing is left half-made if any step fails.
 */
export async function sendInvoice(
  conn: Conn,
  scope: { workspaceId: string; ownerId: string },
  id: string,
) {
  return conn.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.workspaceId, scope.workspaceId)))
      .for("update")
    if (!invoice) throw new InvoiceError("not_found", "That invoice doesn't exist")
    if (invoice.status !== "draft")
      throw new InvoiceError("wrong_state", "This invoice was already sent")
    const input = await draftInputOf(tx, invoice)
    const totals = check(input, true)

    const [customer] = await tx
      .select()
      .from(customers)
      .where(eq(customers.id, input.customerId ?? ""))
    if (!customer) throw new InvoiceError("invalid", "Choose who you're billing", "customer")
    const [account] = await tx
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, scope.ownerId), eq(accounts.network, invoice.network)))
    if (!account?.readyAt) throw new InvoiceError("not_ready", "Your account is still being set up")

    const [business] = await tx
      .update(workspaces)
      .set({
        nextInvoiceNumber: sql`${workspaces.nextInvoiceNumber} + 1`,
        updatedAt: sql`${workspaces.updatedAt}`,
      })
      .where(eq(workspaces.id, scope.workspaceId))
      .returning()
    if (!business) throw new InvoiceError("not_found", "Name your business first")
    const number = business.nextInvoiceNumber - 1

    const [request] = await tx
      .insert(requests)
      .values({
        workspaceId: scope.workspaceId,
        network: invoice.network,
        kind: "invoice",
        token: publicToken(LINK_TOKEN_LENGTH),
        title: `Invoice ${invoiceNumber(number)}`,
        note: customer.name,
        amount: totals.total,
        reusable: false,
        receiverId: account.accountId,
      })
      .returning()
    if (!request) throw new Error("Could not create the pay request")

    let scheduleId: string | null = null
    if (invoice.repeat) {
      const tz = business.timezone
      const [y, m, d] = invoice.issueDate.split("-").map(Number)
      const first = atLocal({ year: y ?? 1970, month: m ?? 1, day: d ?? 1 }, RUN_HOUR, tz)
      const [schedule] = await tx
        .insert(invoiceSchedules)
        .values({
          workspaceId: scope.workspaceId,
          templateId: invoice.id,
          cadence: invoice.repeat,
          termsDays: Math.max(0, daysBetween(invoice.issueDate, invoice.dueDate)),
          nextRunAt: nextRun(invoice.repeat, first, tz, d ?? 1),
        })
        .returning({ id: invoiceSchedules.id })
      scheduleId = schedule?.id ?? null
    }

    const [sent] = await tx
      .update(invoices)
      .set({
        status: "open",
        number,
        requestId: request.id,
        sentAt: new Date(),
        scheduleId,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        billFrom: {
          name: business.name,
          email: business.email,
          address: business.address,
          taxId: business.taxId,
        },
        billTo: {
          name: customer.name,
          email: customer.email,
          address: customer.address,
          taxId: customer.taxId,
        },
      })
      .where(eq(invoices.id, invoice.id))
      .returning()
    await tx.insert(invoiceEvents).values({
      invoiceId: invoice.id,
      kind: "sent",
      detail: { number: invoiceNumber(number) },
    })
    if (!sent) throw new Error("Could not send the invoice")
    return { invoice: sent, token: request.token, timezone: business.timezone }
  })
}

/** When an invoice's reminders fire (09:00 local), only those still ahead. */
export function reminderTimes(dueDate: string, timezone: string, now = new Date()) {
  return REMINDER_DAYS.map((offset) => {
    const [y, m, d] = addDays(dueDate, offset).split("-").map(Number)
    return {
      offset,
      at: atLocal({ year: y ?? 1970, month: m ?? 1, day: d ?? 1 }, RUN_HOUR, timezone),
    }
  }).filter((r) => r.at > now)
}

// --- after sending -----------------------------------------------------------------------------------------

export async function voidInvoice(db: Db, workspaceId: string, id: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(invoices)
      .set({ status: "void", voidedAt: new Date() })
      .where(
        and(
          eq(invoices.id, id),
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.status, "open"),
        ),
      )
      .returning()
    if (!row) throw new InvoiceError("wrong_state", "Only an unpaid invoice can be voided")
    if (row.requestId)
      await tx.update(requests).set({ status: "closed" }).where(eq(requests.id, row.requestId))
    if (row.scheduleId)
      await tx
        .update(invoiceSchedules)
        .set({ active: false })
        .where(eq(invoiceSchedules.id, row.scheduleId))
    await tx.insert(invoiceEvents).values({ invoiceId: row.id, kind: "voided" })
    return row
  })
}

/**
 * Record money that arrived outside Tegata (a bank transfer, cash). It counts toward the invoice like any payment
 * and gets a receipt, which says it was marked paid by hand and has no NEAR transaction.
 */
export async function markPaidByHand(
  db: Db,
  workspaceId: string,
  id: string,
  input: { amount: bigint; note: string | null },
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ invoice: invoices, request: requests })
      .from(invoices)
      .innerJoin(requests, eq(requests.id, invoices.requestId))
      .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
      .for("update")
    if (row?.invoice.status !== "open")
      throw new InvoiceError("wrong_state", "Only an unpaid invoice can be marked paid")
    const remaining = (row.request.amount ?? 0n) - row.request.paidTotal
    if (input.amount < CENT || input.amount > remaining || input.amount % CENT !== 0n)
      throw new InvoiceError("invalid", `Enter up to $${formatUsd(remaining)}`, "amount")
    const paymentId = crypto.randomUUID()
    const [payment] = await tx
      .insert(payments)
      .values({
        id: paymentId,
        requestId: row.request.id,
        network: row.request.network,
        rail: "manual",
        status: "succeeded",
        amount: input.amount,
        memo: `tegata:manual:${paymentId}`,
        receiverId: row.request.receiverId,
        payer: input.note?.trim().slice(0, 120) || null,
        settledAt: new Date(),
      })
      .returning()
    if (!payment) throw new Error("Could not record the payment")
    await tx.insert(invoiceEvents).values({
      invoiceId: row.invoice.id,
      kind: "marked_paid",
      detail: { amount: input.amount.toString(), note: input.note?.trim() || null },
    })
    await applyPayment(tx, payment)
    return payment
  })
}

/** A new draft from any invoice: same customer and items, dated today, same payment terms. */
export async function duplicateInvoice(db: Conn, workspaceId: string, id: string) {
  const [row] = await db
    .select({ invoice: invoices, timezone: workspaces.timezone })
    .from(invoices)
    .innerJoin(workspaces, eq(workspaces.id, invoices.workspaceId))
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
  if (!row) throw new InvoiceError("not_found", "That invoice doesn't exist")
  const input = await draftInputOf(db, row.invoice)
  const today = localToday(row.timezone)
  const terms = Math.max(0, daysBetween(row.invoice.issueDate, row.invoice.dueDate))
  const { totals, values } = draftValues({
    ...input,
    issueDate: today,
    dueDate: addDays(today, terms),
    repeat: null,
  })
  const [copy] = await db
    .insert(invoices)
    .values({ ...values, workspaceId, network: row.invoice.network })
    .returning()
  if (!copy) throw new Error("Could not copy the invoice")
  await writeLines(db, copy.id, input, totals.lines)
  await db.insert(invoiceEvents).values({
    invoiceId: copy.id,
    kind: "created",
    detail: { from: row.invoice.number ? invoiceNumber(row.invoice.number) : null },
  })
  return copy
}

/** The first open of the public page by anyone but the owner records Viewed. */
export async function markViewed(db: Db, token: string, viewerUserId: string | null) {
  const [row] = await db
    .select({
      id: invoices.id,
      viewedAt: invoices.viewedAt,
      status: invoices.status,
      ownerId: workspaces.ownerId,
    })
    .from(invoices)
    .innerJoin(requests, eq(requests.id, invoices.requestId))
    .innerJoin(workspaces, eq(workspaces.id, invoices.workspaceId))
    .where(eq(requests.token, token))
  if (!row || row.viewedAt || row.status !== "open" || row.ownerId === viewerUserId) return false
  const [updated] = await db
    .update(invoices)
    .set({ viewedAt: new Date() })
    .where(and(eq(invoices.id, row.id), sql`${invoices.viewedAt} is null`))
    .returning({ id: invoices.id })
  if (updated) await db.insert(invoiceEvents).values({ invoiceId: row.id, kind: "viewed" })
  return Boolean(updated)
}

export async function logInvoiceEvent(
  db: Db,
  invoiceId: string,
  kind: "emailed" | "email_failed" | "reminder",
  detail?: Record<string, string | number | null>,
) {
  await db.insert(invoiceEvents).values({ invoiceId, kind, detail: detail ?? null })
}

// --- reading ----------------------------------------------------------------------------------------------

/** The business's invoices on one network, so Live's totals are Live money only. */
export async function listInvoices(db: Db, workspaceId: string, network: NetworkId) {
  const [business] = await db
    .select({ timezone: workspaces.timezone })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
  const today = localToday(business?.timezone ?? "UTC")
  const rows = await db
    .select({
      invoice: invoices,
      paidTotal: requests.paidTotal,
      token: requests.token,
      customerName: customers.name,
    })
    .from(invoices)
    .leftJoin(requests, eq(requests.id, invoices.requestId))
    .leftJoin(customers, eq(customers.id, invoices.customerId))
    .where(and(eq(invoices.workspaceId, workspaceId), eq(invoices.network, network)))
    .orderBy(desc(invoices.createdAt))
  return rows.map(({ invoice, paidTotal, token, customerName }) => {
    const paid = paidTotal ?? 0n
    return {
      id: invoice.id,
      number: invoice.number,
      customer: invoice.billTo?.name ?? customerName ?? null,
      customerId: invoice.customerId,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      total: invoice.total,
      paid,
      remaining:
        invoice.status === "open" ? (invoice.total > paid ? invoice.total - paid : 0n) : 0n,
      status: displayStatus(invoice, paid, today),
      token,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
    }
  })
}

export async function getInvoice(db: Db, workspaceId: string, id: string) {
  const [row] = await db
    .select({ invoice: invoices, request: requests, timezone: workspaces.timezone })
    .from(invoices)
    .innerJoin(workspaces, eq(workspaces.id, invoices.workspaceId))
    .leftJoin(requests, eq(requests.id, invoices.requestId))
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
  if (!row) return undefined
  const [lines, events, paid, customer] = await Promise.all([
    db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, id))
      .orderBy(asc(invoiceLines.position)),
    db
      .select()
      .from(invoiceEvents)
      .where(eq(invoiceEvents.invoiceId, id))
      .orderBy(asc(invoiceEvents.createdAt)),
    row.request
      ? db
          .select({ payment: payments, receiptToken: receipts.token })
          .from(payments)
          .leftJoin(receipts, eq(receipts.paymentId, payments.id))
          .where(eq(payments.requestId, row.request.id))
          .orderBy(desc(payments.createdAt))
      : Promise.resolve([]),
    row.invoice.customerId
      ? db.select().from(customers).where(eq(customers.id, row.invoice.customerId))
      : Promise.resolve([]),
  ])
  const paidTotal = row.request?.paidTotal ?? 0n
  return {
    invoice: row.invoice,
    lines,
    events,
    customer: customer[0] ?? null,
    payments: paid.map((p) => ({ ...p.payment, receiptToken: p.receiptToken })),
    token: row.request?.token ?? null,
    paidTotal,
    remaining:
      row.invoice.status === "open" && row.invoice.total > paidTotal
        ? row.invoice.total - paidTotal
        : 0n,
    status: displayStatus(row.invoice, paidTotal, localToday(row.timezone)),
    draft: row.invoice.status === "draft" ? await draftInputOf(db, row.invoice) : null,
    timezone: row.timezone,
  }
}

// --- reminders on a sent invoice -----------------------------------------------------------------------------------

/** How a reminder step reads: "3 days before it's due", "on the due date", "3 days late", "final". */
export function reminderStepWord(offset: number) {
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`
  if (offset < 0) return `${days(-offset)} before it's due`
  if (offset === 0) return "on the due date"
  return offset >= 7 ? "final" : `${days(offset)} late`
}

/** What the invoice page says about reminders: the next one, how many are left, and whether one can go now. */
export function reminderState(
  d: {
    invoice: typeof invoices.$inferSelect
    events: (typeof invoiceEvents.$inferSelect)[]
    remaining: bigint
    timezone: string
  },
  emailOn: boolean,
  now = new Date(),
) {
  if (d.invoice.status !== "open" || d.remaining <= 0n) return null
  const why = !emailOn
    ? "Email isn't set up here"
    : !d.invoice.billTo?.email
      ? "No email for this customer"
      : null
  const ahead = reminderTimes(d.invoice.dueDate, d.timezone, now)
  const today = localToday(d.timezone, now)
  const remindedToday = d.events.some(
    (e) =>
      e.kind === "reminder" &&
      e.detail?.source === "manual" &&
      localToday(d.timezone, e.createdAt) === today,
  )
  const next = d.invoice.reminders ? ahead[0] : undefined
  return {
    on: d.invoice.reminders,
    next: next
      ? {
          at: next.at.toISOString(),
          offset: next.offset,
          label: `${new Intl.DateTimeFormat("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: d.timezone,
          }).format(next.at)} · ${reminderStepWord(next.offset)}`,
        }
      : null,
    left: ahead.length,
    canSend: why === null,
    why,
    email: d.invoice.billTo?.email ?? null,
    remindedToday,
    /** Days from the due date today, for a reminder sent now. */
    offsetToday: daysBetween(d.invoice.dueDate, today),
    today,
  }
}

export type ReminderState = NonNullable<ReturnType<typeof reminderState>>

/** Switch an open invoice's scheduled reminders on or off; the worker reads the flag before each one. */
export async function setInvoiceReminders(db: Db, workspaceId: string, id: string, on: boolean) {
  const [row] = await db
    .update(invoices)
    .set({ reminders: on })
    .where(
      and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId), eq(invoices.status, "open")),
    )
    .returning()
  if (!row) throw new InvoiceError("wrong_state", "Reminders change only on a sent, unpaid invoice")
  return row
}

/**
 * Every reminder step that falls in the next `windowMs`, for every open invoice with reminders on and a customer
 * email. The hourly sweep queues these at their time; the outbox's per-step key means a step queued twice (here and
 * at send) still goes once.
 */
export async function remindersDue(db: Db, now = new Date(), windowMs = 60 * 60 * 1000) {
  const rows = await db
    .select({ invoice: invoices, request: requests, timezone: workspaces.timezone })
    .from(invoices)
    .innerJoin(requests, eq(requests.id, invoices.requestId))
    .innerJoin(workspaces, eq(workspaces.id, invoices.workspaceId))
    .where(and(eq(invoices.status, "open"), eq(invoices.reminders, true)))
  const until = now.getTime() + windowMs
  return rows.flatMap((r) => {
    if (!r.invoice.billTo?.email || (r.request.amount ?? 0n) <= r.request.paidTotal) return []
    return reminderTimes(r.invoice.dueDate, r.timezone, now)
      .filter((t) => t.at.getTime() <= until)
      .map((t) => ({ invoiceId: r.invoice.id, offset: t.offset, at: t.at }))
  })
}

/** The public invoice page: the document as sent, never a draft, plus what is left to pay. */
export async function publicInvoice(db: Db, token: string) {
  const [row] = await db
    .select({ invoice: invoices, request: requests, business: workspaces })
    .from(requests)
    .innerJoin(invoices, eq(invoices.requestId, requests.id))
    .innerJoin(workspaces, eq(workspaces.id, invoices.workspaceId))
    .where(eq(requests.token, token))
  if (!row || row.invoice.status === "draft") return undefined
  const [lines, paid] = await Promise.all([
    db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, row.invoice.id))
      .orderBy(asc(invoiceLines.position)),
    db
      .select({
        amount: payments.amount,
        rail: payments.rail,
        assetIn: payments.assetIn,
        settledAt: payments.settledAt,
        receiptToken: receipts.token,
      })
      .from(payments)
      .innerJoin(receipts, eq(receipts.paymentId, payments.id))
      .where(and(eq(payments.requestId, row.request.id), eq(payments.status, "succeeded")))
      .orderBy(asc(payments.settledAt)),
  ])
  const paidTotal = row.request.paidTotal
  return {
    invoice: row.invoice,
    lines,
    receipts: paid,
    business: row.business,
    token,
    receiverId: row.request.receiverId,
    paidTotal,
    remaining:
      row.invoice.status === "open" && row.invoice.total > paidTotal
        ? row.invoice.total - paidTotal
        : 0n,
    status: displayStatus(row.invoice, paidTotal, localToday(row.business.timezone)),
  }
}

/**
 * For the worker: is this invoice still worth a reminder, and to whom. A reminder the owner sends by hand
 * (`manual`) goes even with the scheduled ones switched off.
 */
export async function reminderTarget(db: Db, invoiceId: string, { manual = false } = {}) {
  const [row] = await db
    .select({ invoice: invoices, request: requests })
    .from(invoices)
    .innerJoin(requests, eq(requests.id, invoices.requestId))
    .where(eq(invoices.id, invoiceId))
  if (row?.invoice.status !== "open" || (!row.invoice.reminders && !manual)) return undefined
  const remaining = (row.request.amount ?? 0n) - row.request.paidTotal
  if (remaining <= 0n || !row.invoice.billTo?.email) return undefined
  return { invoice: row.invoice, token: row.request.token, remaining }
}

/**
 * Issue every repeat that is due: claim the schedule (moving it to its next run in the same transaction, so a run
 * happens once), copy the template as a draft dated today, and send it. Returns the invoices sent.
 */
export async function runDueSchedules(db: Db, now = new Date()) {
  const due = await db
    .select({
      schedule: invoiceSchedules,
      timezone: workspaces.timezone,
      ownerId: workspaces.ownerId,
    })
    .from(invoiceSchedules)
    .innerJoin(workspaces, eq(workspaces.id, invoiceSchedules.workspaceId))
    .where(and(eq(invoiceSchedules.active, true), lte(invoiceSchedules.nextRunAt, now)))
  const sent: { invoiceId: string; token: string; timezone: string }[] = []
  for (const { schedule, timezone, ownerId } of due) {
    const result = await db.transaction(async (tx) => {
      const [template] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, schedule.templateId))
      if (!template || template.status === "void") {
        await tx
          .update(invoiceSchedules)
          .set({ active: false })
          .where(eq(invoiceSchedules.id, schedule.id))
        return undefined
      }
      const anchor = Number(template.issueDate.slice(8, 10))
      const [claimed] = await tx
        .update(invoiceSchedules)
        .set({
          nextRunAt: nextRun(schedule.cadence, schedule.nextRunAt, timezone, anchor),
          lastRunAt: now,
        })
        .where(
          and(
            eq(invoiceSchedules.id, schedule.id),
            eq(invoiceSchedules.nextRunAt, schedule.nextRunAt),
          ),
        )
        .returning()
      if (!claimed) return undefined
      const copy = await duplicateInvoice(tx, schedule.workspaceId, template.id)
      const today = localToday(timezone)
      await tx
        .update(invoices)
        .set({ issueDate: today, dueDate: addDays(today, schedule.termsDays) })
        .where(eq(invoices.id, copy.id))
      const issued = await sendInvoice(tx, { workspaceId: schedule.workspaceId, ownerId }, copy.id)
      return { invoiceId: issued.invoice.id, token: issued.token, timezone }
    })
    if (result) sent.push(result)
  }
  return sent
}

// --- customers --------------------------------------------------------------------------------------------

export interface CustomerInput {
  name: string
  email?: string | null
  address?: string | null
  taxId?: string | null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function customerValues(input: CustomerInput) {
  const name = input.name.trim()
  if (name.length < 1 || name.length > 80)
    throw new InvoiceError("invalid", "Give the customer a name", "name")
  const email = input.email?.trim() || null
  if (email && !EMAIL.test(email))
    throw new InvoiceError("invalid", "Enter an email like ana@company.com", "email")
  return {
    name,
    email,
    address: input.address?.trim().slice(0, 300) || null,
    taxId: input.taxId?.trim().slice(0, 40) || null,
  }
}

export async function createCustomer(db: Db, workspaceId: string, input: CustomerInput) {
  const [row] = await db
    .insert(customers)
    .values({ ...customerValues(input), workspaceId })
    .returning()
  if (!row) throw new Error("Could not add the customer")
  return row
}

export async function updateCustomer(
  db: Db,
  workspaceId: string,
  id: string,
  input: CustomerInput,
) {
  const [row] = await db
    .update(customers)
    .set(customerValues(input))
    .where(and(eq(customers.id, id), eq(customers.workspaceId, workspaceId)))
    .returning()
  if (!row) throw new InvoiceError("not_found", "That customer doesn't exist")
  return row
}

/** Customers with what they were billed, paid and still owe on one network (sent invoices only). */
export async function listCustomers(db: Db, workspaceId: string, network: NetworkId) {
  const [rows, billed] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(eq(customers.workspaceId, workspaceId))
      .orderBy(asc(customers.name)),
    db
      .select({
        customerId: invoices.customerId,
        total: invoices.total,
        status: invoices.status,
        paid: requests.paidTotal,
      })
      .from(invoices)
      .innerJoin(requests, eq(requests.id, invoices.requestId))
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.network, network),
          inArray(invoices.status, ["open", "paid"]),
        ),
      ),
  ])
  return rows.map((customer) => {
    const mine = billed.filter((b) => b.customerId === customer.id)
    const invoiced = mine.reduce((sum, b) => sum + b.total, 0n)
    // biome-ignore lint/complexity/useMathMinMax: bigint money; Math.min would coerce and throw.
    const paid = mine.reduce((sum, b) => sum + (b.paid > b.total ? b.total : b.paid), 0n)
    return { ...customer, invoices: mine.length, invoiced, paid, outstanding: invoiced - paid }
  })
}

// --- documents (PDF and email) ----------------------------------------------------------------------------

/** An invoice as the PDF and the emails need it, by its public token. */
export async function invoiceDocuments(db: Db, token: string, appUrl: string) {
  const found = await publicInvoice(db, token)
  if (!found) return undefined
  const { invoice, lines, business } = found
  const logo = await businessLogo(db, business.id)
  const number = invoiceNumber(invoice.number ?? 0)
  const from = invoice.billFrom ?? {
    name: business.name,
    email: business.email,
    address: business.address,
    taxId: business.taxId,
  }
  const url = `${appUrl.replace(/\/$/, "")}/i/${token}`
  return {
    to: invoice.billTo?.email ?? null,
    document: {
      number,
      status:
        invoice.status === "paid"
          ? ("paid" as const)
          : invoice.status === "void"
            ? ("void" as const)
            : ("open" as const),
      from,
      to: invoice.billTo,
      // The PDF embeds PNG and JPEG only; anything else falls back to the seal.
      logo:
        logo && (logo.type === "image/png" || logo.type === "image/jpeg")
          ? `data:${logo.type};base64,${logo.bytes.toString("base64")}`
          : null,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      lines: lines.map((line) => ({
        description: line.description,
        quantity: quantityText(line.quantityMilli),
        unitPrice: line.unitPrice.toString(),
        amount: line.amount.toString(),
      })),
      subtotal: invoice.subtotal.toString(),
      discount: invoice.discount.toString(),
      discountLabel:
        invoice.discountKind === "percent" && invoice.discountValue !== null
          ? `Discount ${percentText(Number(invoice.discountValue))}%`
          : "Discount",
      tax: invoice.tax.toString(),
      taxLabel: invoice.taxBp ? `Tax ${percentText(invoice.taxBp)}%` : null,
      total: invoice.total.toString(),
      paidTotal: found.paidTotal.toString(),
      remaining: found.remaining.toString(),
      notes: invoice.notes,
      payUrl: url,
      payAddress: found.receiverId,
      sandbox: invoice.network === "testnet",
      // Paid only by hand (cash, a wire): the footer says so instead of naming the NEAR pay address.
      byHand: found.receipts.length > 0 && found.receipts.every((r) => r.rail === "manual"),
    },
    email: {
      business: from.name,
      customer: invoice.billTo?.name ?? "there",
      number,
      total: invoice.total.toString(),
      remaining: found.remaining.toString(),
      dueDate: invoice.dueDate,
      url,
      notes: invoice.notes,
      sandbox: invoice.network === "testnet",
    },
  }
}

/** The public token of a sent invoice. */
export async function invoiceToken(db: Db, invoiceId: string) {
  const [row] = await db
    .select({ token: requests.token, dueDate: invoices.dueDate, reminders: invoices.reminders })
    .from(invoices)
    .innerJoin(requests, eq(requests.id, invoices.requestId))
    .where(eq(invoices.id, invoiceId))
  return row
}

// --- first steps (Home) -------------------------------------------------------------------------------------------

/** Which first steps a business has taken, so Home stops suggesting what it has already done. */
export async function firstSteps(db: Db, workspaceId: string) {
  const [[invoice], [link]] = await Promise.all([
    db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.workspaceId, workspaceId), sql`${invoices.number} is not null`))
      .limit(1),
    db
      .select({ id: requests.id })
      .from(requests)
      .where(and(eq(requests.workspaceId, workspaceId), eq(requests.kind, "link")))
      .limit(1),
  ])
  return { invoiceSent: invoice !== undefined, linkMade: link !== undefined }
}
