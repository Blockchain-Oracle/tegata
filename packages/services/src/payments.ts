import { NETWORKS, type NetworkId } from "@tegata/config"
import { invoiceNumber } from "@tegata/core/invoices"
import { formatUsd } from "@tegata/core/money"
import { ftTransfer, matchingTransfer, readUsdcTransfers } from "@tegata/core/near"
import { type Db, schema } from "@tegata/db"
import { and, desc, eq, inArray, sql } from "drizzle-orm"

import { emitEvent, paymentObject } from "./events.ts"
import { createRelayDraft } from "./relays.ts"

const { requests, payments, receipts, workspaces, accounts, relays, invoices, invoiceEvents } =
  schema

/** A database transaction, for steps that must happen together. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

const TOKEN_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
const LINK_TOKEN_LENGTH = 12
const RECEIPT_TOKEN_LENGTH = 16
/** Keep titles and notes to what fits on a pay page and a receipt. */
export const LINK_LIMITS = {
  title: 80,
  note: 280,
  minUnits: 10_000n,
  maxUnits: 1_000_000_000_000n,
} as const

export class PaymentError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "closed"
      | "bad_amount"
      | "not_ready"
      | "wrong_state"
      | "unpaid"
      | "no_route",
    message: string,
  ) {
    super(message)
  }
}

/** An unguessable, readable public token: no 0/O/1/l/I. */
export function publicToken(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("")
}

/** The memo that ties an on-chain USDC transfer to one attempt. */
export const memoFor = (paymentId: string) => `tegata:pay:${paymentId}`

// --- links (the business side) -----------------------------------------------------------------------------

export async function createLink(
  db: Db,
  input: {
    workspaceId: string
    ownerId: string
    network: NetworkId
    title: string
    note?: string
    amount?: bigint
  },
) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, input.ownerId), eq(accounts.network, input.network)))
  if (!account?.readyAt) throw new PaymentError("not_ready", "Your account is still being set up")
  if (
    input.amount !== undefined &&
    (input.amount < LINK_LIMITS.minUnits || input.amount > LINK_LIMITS.maxUnits)
  ) {
    throw new PaymentError("bad_amount", "Enter an amount between $0.01 and $1,000,000")
  }
  const [row] = await db
    .insert(requests)
    .values({
      workspaceId: input.workspaceId,
      network: input.network,
      kind: "link",
      token: publicToken(LINK_TOKEN_LENGTH),
      title: input.title.trim().slice(0, LINK_LIMITS.title),
      note: input.note?.trim().slice(0, LINK_LIMITS.note) || null,
      amount: input.amount ?? null,
      reusable: true,
      receiverId: account.accountId,
    })
    .returning()
  if (!row) throw new Error("Could not create the link")
  return row
}

export function listLinks(db: Db, workspaceId: string) {
  return db
    .select()
    .from(requests)
    .where(and(eq(requests.workspaceId, workspaceId), eq(requests.kind, "link")))
    .orderBy(desc(requests.createdAt))
}

export async function getLink(db: Db, workspaceId: string, id: string) {
  const [request] = await db
    .select()
    .from(requests)
    .where(and(eq(requests.id, id), eq(requests.workspaceId, workspaceId)))
  if (!request) return undefined
  const rows = await db
    .select({ payment: payments, receiptToken: receipts.token })
    .from(payments)
    .leftJoin(receipts, eq(receipts.paymentId, payments.id))
    .where(eq(payments.requestId, request.id))
    .orderBy(desc(payments.createdAt))
  return { request, payments: rows.map((r) => ({ ...r.payment, receiptToken: r.receiptToken })) }
}

export async function setLinkOpen(db: Db, workspaceId: string, id: string, open: boolean) {
  const [row] = await db
    .update(requests)
    .set({ status: open ? "open" : "closed" })
    .where(and(eq(requests.id, id), eq(requests.workspaceId, workspaceId)))
    .returning()
  return row
}

/** Close a one-time request nobody paid (a cancelled counter sale). A paid one is never touched. */
export async function closeUnpaidRequest(db: Db, workspaceId: string, id: string) {
  const [row] = await db
    .update(requests)
    .set({ status: "closed" })
    .where(
      and(eq(requests.id, id), eq(requests.workspaceId, workspaceId), eq(requests.status, "open")),
    )
    .returning()
  return row
}

// --- the public pay page ------------------------------------------------------------------------------------

export async function publicRequest(db: Db, token: string) {
  const [row] = await db
    .select({ request: requests, ...BUSINESS_HEADER })
    .from(requests)
    .innerJoin(workspaces, eq(workspaces.id, requests.workspaceId))
    .where(eq(requests.token, token))
  if (!row) return undefined
  const [invoice] =
    row.request.kind === "invoice"
      ? await db
          .select({
            number: invoices.number,
            allowPartial: invoices.allowPartial,
            dueDate: invoices.dueDate,
          })
          .from(invoices)
          .where(eq(invoices.requestId, row.request.id))
      : []
  // A one-time request (a checkout session or a counter sale) that is paid has one receipt: show it to whoever comes
  // back to the page, since the page's link was only ever the payer's. A reusable link has many payers and shows none.
  const [receipt] =
    !row.request.reusable && row.request.kind !== "invoice" && row.request.status === "paid"
      ? await db
          .select({ token: receipts.token })
          .from(receipts)
          .innerJoin(payments, eq(payments.id, receipts.paymentId))
          .where(and(eq(payments.requestId, row.request.id), eq(payments.status, "succeeded")))
          .limit(1)
      : []
  return {
    ...row,
    logo: headerLogo(row),
    invoice: invoice ?? null,
    receiptToken: receipt?.token ?? null,
  }
}

/** What a public page's header shows about the business: its name and, if it has one, its logo. */
export const BUSINESS_HEADER = {
  business: workspaces.name,
  workspaceId: workspaces.id,
  hasLogo: sql<boolean>`${workspaces.logoUrl} is not null`,
  workspaceUpdatedAt: workspaces.updatedAt,
}

export const headerLogo = (row: {
  workspaceId: string
  hasLogo: boolean
  workspaceUpdatedAt: Date
}) => (row.hasLogo ? `/api/logo/${row.workspaceId}?v=${row.workspaceUpdatedAt.getTime()}` : null)

/** What an invoice payment may be: what is left, or less when the business allows part-payments. */
async function invoiceAmount(
  db: Db,
  request: typeof requests.$inferSelect,
  asked: bigint | undefined,
): Promise<bigint> {
  const [invoice] = await db
    .select({ status: invoices.status, allowPartial: invoices.allowPartial })
    .from(invoices)
    .where(eq(invoices.requestId, request.id))
  if (invoice?.status !== "open")
    throw new PaymentError("closed", "This invoice isn't taking payments")
  const remaining = (request.amount ?? 0n) - request.paidTotal
  if (remaining <= 0n) throw new PaymentError("closed", "This invoice is already paid")
  if (!invoice.allowPartial || asked === undefined) return remaining
  if (asked > remaining)
    throw new PaymentError("bad_amount", `The most left to pay is $${formatUsd(remaining)}`)
  return asked
}

/** Start an attempt. The amount is the request's, or the payer's own for an open-amount link. */
export async function startAttempt(
  db: Db,
  input: {
    token: string
    rail: "tegata" | "near_wallet" | "oneclick" | "card"
    amount?: bigint
    payer?: string
    payerEmail?: string
  },
) {
  const found = await publicRequest(db, input.token)
  if (!found) throw new PaymentError("not_found", "This pay link doesn't exist")
  const { request } = found
  if (request.status !== "open")
    throw new PaymentError("closed", "This pay link is no longer taking payments")
  const amount =
    request.kind === "invoice"
      ? await invoiceAmount(db, request, input.amount)
      : (request.amount ?? input.amount)
  if (!amount || amount < LINK_LIMITS.minUnits || amount > LINK_LIMITS.maxUnits) {
    throw new PaymentError("bad_amount", "Enter an amount between $0.01 and $1,000,000")
  }
  const id = crypto.randomUUID()
  const [row] = await db
    .insert(payments)
    .values({
      id,
      requestId: request.id,
      network: request.network,
      rail: input.rail,
      amount,
      memo: memoFor(id),
      receiverId: request.receiverId,
      payer: input.payer ?? null,
      payerEmail: input.payerEmail ?? null,
    })
    .returning()
  if (!row) throw new Error("Could not start the payment")
  return row
}

/**
 * The Tegata rail: the payer is signed in, so their transfer goes through our relayer like any send. The server
 * builds the `ft_transfer` with the attempt's memo; the payer only signs it.
 */
export async function draftTegataPayment(
  db: Db,
  input: { paymentId: string; userId: string; publicKey: string; network: NetworkId },
) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, input.paymentId))
  if (payment?.rail !== "tegata") throw new PaymentError("not_found", "Payment not found")
  if (payment.status !== "awaiting")
    throw new PaymentError("wrong_state", "This payment has already started")
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, input.userId), eq(accounts.network, input.network)))
  if (!account?.readyAt)
    throw new PaymentError("not_ready", "Your Tegata account is still being set up")
  if (account.accountId === payment.receiverId)
    throw new PaymentError("bad_amount", "That's your own pay link")

  const { relayId, draft } = await createRelayDraft(db, {
    userId: input.userId,
    network: input.network,
    purpose: `pay:${payment.id}`,
    senderId: account.accountId,
    receiverId: NETWORKS[input.network].usdc,
    publicKey: input.publicKey,
    calls: [ftTransfer(payment.receiverId, payment.amount, payment.memo)],
  })
  await db
    .update(payments)
    .set({ relayId, payer: account.accountId })
    .where(eq(payments.id, payment.id))
  return { relayId, draft, payment }
}

/** The wallet rail: the payer's wallet sent the transfer; remember its hash so the worker can check it. */
export async function claimWalletTx(
  db: Db,
  input: { paymentId: string; txHash: string; payer: string },
) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, input.paymentId))
  if (payment?.rail !== "near_wallet") throw new PaymentError("not_found", "Payment not found")
  if (payment.status !== "awaiting" && payment.status !== "detected") {
    throw new PaymentError("wrong_state", "This payment is already settled")
  }
  const [row] = await db
    .update(payments)
    .set({ txHash: input.txHash, payer: input.payer, status: "detected" })
    .where(eq(payments.id, payment.id))
    .returning()
  return row
}

export type SettleResult = "succeeded" | "pending" | "failed" | "ignored"

/**
 * Settle an attempt from NEAR alone: read the transaction, find the USDC event to the business with the memo and
 * at least the amount, then in one database transaction mark it paid, count it on the request and issue the
 * receipt. Safe to run again: a settled attempt is left alone.
 */
export async function settlePayment(
  db: Db,
  paymentId: string,
  txHash: string,
  senderId: string,
  /** A card on-ramp delivers without Tegata's memo: then the transfer to the business for the amount is enough. */
  options: { anyMemo?: boolean } = {},
): Promise<SettleResult> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))
  if (!payment || payment.status === "succeeded" || payment.status === "failed") return "ignored"

  const read = await readUsdcTransfers(payment.network, txHash, senderId)
  if (read.state === "pending") return "pending"
  const match = !read.ok
    ? undefined
    : options.anyMemo
      ? read.transfers.find((t) => t.to === payment.receiverId && t.amount >= payment.amount)
      : matchingTransfer(read.transfers, {
          to: payment.receiverId,
          amount: payment.amount,
          memo: payment.memo,
        })
  if (!match) {
    await db
      .update(payments)
      .set({
        status: "failed",
        txHash,
        error: read.ok
          ? "That transaction didn't pay this link"
          : `The transfer failed on NEAR: ${read.error}`.slice(0, 500),
      })
      .where(
        and(
          eq(payments.id, payment.id),
          inArray(payments.status, ["awaiting", "detected", "settling"]),
        ),
      )
    return "failed"
  }

  await db.transaction(async (tx) => {
    const [settled] = await tx
      .update(payments)
      .set({
        status: "succeeded",
        txHash,
        payer: payment.payer ?? match.from,
        settledAt: new Date(),
        error: null,
      })
      .where(
        and(
          eq(payments.id, payment.id),
          inArray(payments.status, ["awaiting", "detected", "settling"]),
        ),
      )
      .returning()
    if (!settled) return
    await applyPayment(tx, settled)
  })
  return "succeeded"
}

/**
 * Inside the settling transaction: count the payment on its request, give it the business's next receipt number
 * (one atomic counter, so two payments at once never share a number), and move an invoice to Paid when the full
 * amount is in. Used for payments read from NEAR and for payments a business marks paid by hand.
 */
export async function applyPayment(
  tx: Tx,
  payment: { id: string; requestId: string; amount: bigint; rail: string },
) {
  const [request] = await tx
    .update(requests)
    .set({
      paidCount: sql`${requests.paidCount} + 1`,
      paidTotal: sql`${requests.paidTotal} + ${payment.amount.toString()}`,
    })
    .where(eq(requests.id, payment.requestId))
    .returning()
  if (!request) return
  const full = request.amount !== null && request.paidTotal >= request.amount
  if (!request.reusable && full) {
    await tx.update(requests).set({ status: "paid" }).where(eq(requests.id, request.id))
  }
  const [counter] = await tx
    .update(workspaces)
    .set({
      nextReceiptNumber: sql`${workspaces.nextReceiptNumber} + 1`,
      // A new receipt number isn't a profile change: keep the logo's cache version.
      updatedAt: sql`${workspaces.updatedAt}`,
    })
    .where(eq(workspaces.id, request.workspaceId))
    .returning({ next: workspaces.nextReceiptNumber })
  if (!counter) throw new Error("The business for this payment is missing")
  await tx.insert(receipts).values({
    paymentId: payment.id,
    workspaceId: request.workspaceId,
    token: publicToken(RECEIPT_TOKEN_LENGTH),
    number: counter.next - 1,
  })
  // Webhook events: stored in this same transaction, so a payment and its event are never apart.
  const [row] = await tx.select().from(payments).where(eq(payments.id, payment.id))
  if (row) {
    const base = { workspaceId: request.workspaceId, network: request.network }
    await emitEvent(tx, {
      ...base,
      type: "payment.succeeded",
      data: paymentObject(row),
      dedupe: `payment.succeeded:${row.id}`,
    })
    // A top-up to one's own balance isn't a sale: no checkout event for the business's webhooks.
    if (request.kind === "session" && full && request.metadata?.source !== "topup") {
      await emitEvent(tx, {
        ...base,
        type: "checkout.session.completed",
        data: {
          id: request.id,
          object: "checkout.session",
          status: "complete",
          amount: formatUsd(request.amount ?? 0n),
          amount_units: (request.amount ?? 0n).toString(),
          currency: "usd",
          description: request.title,
          success_url: request.successUrl,
          metadata: request.metadata ?? {},
          payment: paymentObject(row),
        },
        dedupe: `checkout.session.completed:${request.id}`,
      })
    }
  }
  if (request.kind !== "invoice") return
  const [invoice] = await tx
    .select({ id: invoices.id, status: invoices.status, number: invoices.number })
    .from(invoices)
    .where(eq(invoices.requestId, request.id))
  if (!invoice) return
  await tx.insert(invoiceEvents).values({
    invoiceId: invoice.id,
    kind: "payment",
    detail: { paymentId: payment.id, amount: payment.amount.toString(), rail: payment.rail },
  })
  if (full && invoice.status === "open") {
    await tx
      .update(invoices)
      .set({ status: "paid", paidAt: new Date() })
      .where(and(eq(invoices.id, invoice.id), eq(invoices.status, "open")))
    await tx.insert(invoiceEvents).values({ invoiceId: invoice.id, kind: "paid" })
    await emitEvent(tx, {
      workspaceId: request.workspaceId,
      network: request.network,
      type: "invoice.paid",
      data: {
        id: invoice.id,
        object: "invoice",
        number: invoice.number === null ? null : invoiceNumber(invoice.number),
        amount: formatUsd(request.amount ?? 0n),
        amount_units: (request.amount ?? 0n).toString(),
        currency: "usd",
        request_id: request.id,
      },
      dedupe: `invoice.paid:${invoice.id}`,
    })
  }
}

/** After a relay lands, settle the payment it carried (the Tegata rail). */
export async function settleRelayedPayment(
  db: Db,
  relayId: string,
  operatorId: string,
): Promise<SettleResult> {
  const [row] = await db
    .select({ payment: payments, relay: relays })
    .from(payments)
    .innerJoin(relays, eq(relays.id, payments.relayId))
    .where(eq(payments.relayId, relayId))
  if (!row) return "ignored"
  if (row.relay.status === "failed" || row.relay.status === "expired") {
    await db
      .update(payments)
      .set({ status: "failed", error: row.relay.error ?? "The transfer didn't go through" })
      .where(
        and(
          eq(payments.id, row.payment.id),
          inArray(payments.status, ["awaiting", "detected", "settling"]),
        ),
      )
    return "failed"
  }
  if (row.relay.status !== "success" || !row.relay.txHash) return "pending"
  // A relayed transaction is signed by the operator, so NEAR looks it up under the operator's account.
  return settlePayment(db, row.payment.id, row.relay.txHash, operatorId)
}

/** Wallet attempts with a hash waiting to be checked (the worker sweeps these at start). */
export function paymentsToVerify(db: Db) {
  return db
    .select({ id: payments.id, txHash: payments.txHash, payer: payments.payer })
    .from(payments)
    .where(and(eq(payments.rail, "near_wallet"), eq(payments.status, "detected")))
}

/** What the pay page polls: the attempt's state and, once paid, its receipt. */
export async function attemptStatus(db: Db, paymentId: string) {
  const [row] = await db
    .select({ payment: payments, receiptToken: receipts.token, relayStatus: relays.status })
    .from(payments)
    .leftJoin(receipts, eq(receipts.paymentId, payments.id))
    .leftJoin(relays, eq(relays.id, payments.relayId))
    .where(eq(payments.id, paymentId))
  return row
}

export async function receiptByToken(db: Db, token: string) {
  const [row] = await db
    .select({ receipt: receipts, payment: payments, request: requests, ...BUSINESS_HEADER })
    .from(receipts)
    .innerJoin(payments, eq(payments.id, receipts.paymentId))
    .innerJoin(requests, eq(requests.id, payments.requestId))
    .innerJoin(workspaces, eq(workspaces.id, receipts.workspaceId))
    .where(eq(receipts.token, token))
  return row && { ...row, logo: headerLogo(row) }
}

/** Links this person paid from their Tegata balance (money out, beside their sends). */
export function listPaymentsOut(db: Db, userId: string, limit = 20) {
  return db
    .select({
      payment: payments,
      title: requests.title,
      business: workspaces.name,
      receiptToken: receipts.token,
    })
    .from(payments)
    .innerJoin(relays, eq(relays.id, payments.relayId))
    .innerJoin(requests, eq(requests.id, payments.requestId))
    .innerJoin(workspaces, eq(workspaces.id, requests.workspaceId))
    .leftJoin(receipts, eq(receipts.paymentId, payments.id))
    .where(
      and(
        eq(relays.userId, userId),
        inArray(payments.status, ["detected", "settling", "succeeded", "failed"]),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(limit)
}

/** Money in for a business: succeeded payments, newest first (Home's activity). */
export function listPaymentsIn(db: Db, workspaceId: string, limit = 20) {
  return db
    .select({ payment: payments, title: requests.title, receiptToken: receipts.token })
    .from(payments)
    .innerJoin(requests, eq(requests.id, payments.requestId))
    .leftJoin(receipts, eq(receipts.paymentId, payments.id))
    .where(and(eq(requests.workspaceId, workspaceId), eq(payments.status, "succeeded")))
    .orderBy(desc(payments.settledAt))
    .limit(limit)
}
