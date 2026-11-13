// Who gets which email, for every event. Each function reads what the
// email shows from the database, captures it as the event's data, and queues it in the outbox (notify.ts) with a
// dedupe key, so calling it twice sends once. Links are app paths; the layout makes them absolute.
import { NETWORKS, type NetworkId, REFERRALS } from "@tegata/config"
import { explorerTx } from "@tegata/core/near"
import { assetLabel, type QuoteResponse, routeLabel } from "@tegata/core/oneclick"
import { type Db, schema } from "@tegata/db"
import type { MoveData, PaymentData } from "@tegata/documents"
import { and, eq, gte, inArray } from "drizzle-orm"

import { monthRange, movements, totals } from "./books.ts"
import { logoPath } from "./business.ts"
import type { Conn } from "./events.ts"
import { invoiceDocuments } from "./invoices.ts"
import { ownerAddress, queueEmail } from "./notify.ts"
import { payrollDue } from "./payroll.ts"

const {
  payments,
  requests,
  workspaces,
  users,
  receipts,
  invoices,
  people,
  payRuns,
  payRows,
  personDestinations,
  accounts,
  payouts,
  relays,
  referralPayouts,
  referrals,
} = schema

const sandbox = (network: NetworkId) => network === "testnet"
const invoiceNo = (n: number | null) => (n ? `INV-${String(n).padStart(4, "0")}` : null)

const RAIL_WORD: Record<string, string> = {
  tegata: "Tegata balance",
  near_wallet: "NEAR wallet",
  manual: "Paid by hand",
  card: "Card, through Transak",
}

/** "USDT on Tron → USDC on NEAR" for a payment from another chain. */
async function paidWith(payment: typeof payments.$inferSelect) {
  if (payment.rail !== "oneclick") return RAIL_WORD[payment.rail] ?? payment.rail
  const label = payment.assetIn ? await assetLabel(payment.assetIn).catch(() => null) : null
  return label ? `${label.symbol} on ${label.chain} → USDC on NEAR` : "Another chain → USDC on NEAR"
}

async function workspaceOf(conn: Conn, id: string) {
  const [row] = await conn.select().from(workspaces).where(eq(workspaces.id, id))
  return row ?? null
}

/** A NEAR account's owner's email, when the account is a Tegata account. */
async function accountEmail(conn: Conn, accountId: string) {
  const [row] = await conn
    .select({ email: users.email, userId: users.id })
    .from(accounts)
    .innerJoin(users, eq(users.id, accounts.userId))
    .where(eq(accounts.accountId, accountId))
  return row ?? null
}

// --- money in ------------------------------------------------------------------------------------------------------

/** A payment settled: the business hears it was paid; the payer (or the invoice's customer) gets their receipt. */
export async function queuePaymentEmails(db: Db, paymentId: string) {
  const [row] = await db
    .select({
      payment: payments,
      request: requests,
      workspace: workspaces,
      receipt: receipts,
      invoice: invoices,
    })
    .from(payments)
    .innerJoin(requests, eq(requests.id, payments.requestId))
    .innerJoin(workspaces, eq(workspaces.id, requests.workspaceId))
    .innerJoin(receipts, eq(receipts.paymentId, payments.id))
    .leftJoin(invoices, eq(invoices.requestId, requests.id))
    .where(and(eq(payments.id, paymentId), eq(payments.status, "succeeded")))
  if (!row) return
  const { payment, request, workspace, receipt, invoice } = row
  const number = invoice ? invoiceNo(invoice.number) : null
  const remaining = request.kind === "invoice" ? (request.amount ?? 0n) - request.paidTotal : null
  const data: PaymentData = {
    business: workspace.name,
    logo: logoPath(workspace),
    sandbox: sandbox(payment.network),
    timezone: workspace.timezone,
    at: (payment.settledAt ?? payment.createdAt).toISOString(),
    txHash: payment.txHash,
    explorerUrl: payment.txHash ? explorerTx(payment.network, payment.txHash) : null,
    amount: payment.amount.toString(),
    title: number ? `Invoice ${number}` : request.title,
    from: payment.payer,
    paidWith: await paidWith(payment),
    receiptUrl: `/r/${receipt.token}`,
    receiptNumber: receipt.number,
    remaining: remaining !== null && remaining > 0n ? remaining.toString() : null,
    invoiceNumber: number,
    ownerUrl: invoice
      ? `/app/invoices/${invoice.id}`
      : request.kind === "link"
        ? `/app/links/${request.id}`
        : null,
  }
  await queueEmail(db, {
    event: { kind: "payment.received", data },
    to: await ownerAddress(db, workspace.id),
    dedupe: `payment.received:${payment.id}`,
    workspaceId: workspace.id,
  })
  await queueEmail(db, {
    event: { kind: "payment.receipt", data },
    to: payment.payerEmail ?? invoice?.billTo?.email,
    dedupe: `payment.receipt:${payment.id}`,
    workspaceId: workspace.id,
  })
}

/** NEAR Intents returned a payer's coins (too late, too little): the business hears the payment didn't complete. */
export async function queuePayinRefundedEmail(db: Db, paymentId: string) {
  const [row] = await db
    .select({ payment: payments, request: requests })
    .from(payments)
    .innerJoin(requests, eq(requests.id, payments.requestId))
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.status, "refunded"),
        eq(payments.rail, "oneclick"),
      ),
    )
  if (!row) return
  const workspace = await workspaceOf(db, row.request.workspaceId)
  if (!workspace) return
  const label = row.payment.assetIn ? await assetLabel(row.payment.assetIn).catch(() => null) : null
  await queueEmail(db, {
    event: {
      kind: "payin.refunded",
      data: {
        business: workspace.name,
        sandbox: sandbox(row.payment.network),
        amount: row.payment.amount.toString(),
        route: label ? `${label.symbol} on ${label.chain}` : "another chain",
        title: row.request.title,
        url: row.request.kind === "link" ? `/app/links/${row.request.id}` : "/app/activity",
      },
    },
    to: await ownerAddress(db, workspace.id),
    dedupe: `payin.refunded:${paymentId}`,
    workspaceId: workspace.id,
  })
}

// --- money out -----------------------------------------------------------------------------------------------------

function moveBase(
  workspace: typeof workspaces.$inferSelect,
  network: NetworkId,
  at: Date,
  txHash: string | null,
) {
  return {
    business: workspace.name,
    logo: logoPath(workspace),
    sandbox: sandbox(network),
    timezone: workspace.timezone,
    at: at.toISOString(),
    txHash,
    explorerUrl: txHash ? explorerTx(network, txHash) : null,
  }
}

/** A refund counted against a payment: the business gets its copy; the payer hears they were refunded. */
export async function queueRefundEmails(
  conn: Conn,
  input: {
    paymentId: string
    amount: bigint
    txHash: string | null
    dedupe: string
    receiptUrl: string | null
  },
) {
  const [row] = await conn
    .select({ payment: payments, request: requests, invoice: invoices })
    .from(payments)
    .innerJoin(requests, eq(requests.id, payments.requestId))
    .leftJoin(invoices, eq(invoices.requestId, requests.id))
    .where(eq(payments.id, input.paymentId))
  if (!row) return
  const workspace = await workspaceOf(conn, row.request.workspaceId)
  if (!workspace) return
  const number = row.invoice ? invoiceNo(row.invoice.number) : null
  const to = row.payment.rail === "oneclick" ? row.payment.refundTo : row.payment.payer
  const data: MoveData = {
    ...moveBase(workspace, row.payment.network, new Date(), input.txHash),
    amount: input.amount.toString(),
    counterparty: to ?? "the payer",
    title: `Refund of ${number ? `Invoice ${number}` : row.request.title}`,
    receiptUrl: input.receiptUrl,
  }
  await queueEmail(conn, {
    event: { kind: "refund.sent", data },
    to: await ownerAddress(conn, workspace.id),
    dedupe: `refund.sent:${input.dedupe}`,
    workspaceId: workspace.id,
  })
  const payerEmail =
    row.payment.payerEmail ??
    row.invoice?.billTo?.email ??
    (row.payment.payer ? (await accountEmail(conn, row.payment.payer))?.email : null)
  await queueEmail(conn, {
    event: { kind: "refund.received", data },
    to: payerEmail,
    dedupe: `refund.received:${input.dedupe}`,
    workspaceId: workspace.id,
  })
}

/** A one-off send on NEAR landed: the business gets its copy; a Tegata account on the other end hears it arrived. */
export async function queueSendEmails(db: Db, relayId: string) {
  const [relay] = await db.select().from(relays).where(eq(relays.id, relayId))
  if (relay?.status !== "success" || !relay.purpose.startsWith("send:")) return
  const call = (relay.draft as { calls?: { method: string; argsJson: string }[] }).calls?.[0]
  if (call?.method !== "ft_transfer") return
  const args = JSON.parse(call.argsJson) as { receiver_id: string; amount: string }
  const [owner] = await db.select().from(workspaces).where(eq(workspaces.ownerId, relay.userId))
  if (!owner) return
  const data: MoveData = {
    ...moveBase(owner, relay.network, relay.updatedAt, relay.txHash),
    amount: args.amount,
    counterparty: args.receiver_id,
    title: "One-off payment",
    receiptUrl: `/r/send/${relay.id}`,
  }
  await queueEmail(db, {
    event: { kind: "send.sent", data },
    to: await ownerAddress(db, owner.id),
    dedupe: `send.sent:${relay.id}`,
    workspaceId: owner.id,
  })
  const recipient = await accountEmail(db, args.receiver_id)
  if (recipient && recipient.userId !== relay.userId)
    await queueEmail(db, {
      event: { kind: "send.received", data },
      to: recipient.email,
      dedupe: `send.received:${relay.id}`,
      workspaceId: owner.id,
    })
}

/** A payout to another chain finished: delivered (with what arrived and where), or returned to the balance. */
export async function queuePayoutEmail(db: Db, payoutId: string) {
  const [payout] = await db.select().from(payouts).where(eq(payouts.id, payoutId))
  if (!payout || !["delivered", "refunded", "failed"].includes(payout.status)) return
  const workspace = await workspaceOf(db, payout.workspaceId)
  if (!workspace) return
  // A refund to the payer's chain is told by queueRefundEmails once it counts; a payroll row by its payslip. Only a
  // payroll row that came back is worth its own email.
  if ((payout.kind === "refund" || payout.kind === "payroll") && payout.status === "delivered")
    return
  const quote = payout.quote as QuoteResponse | null
  const data: MoveData = {
    ...moveBase(workspace, payout.network, payout.deliveredAt ?? payout.updatedAt, payout.txHash),
    amount: payout.amount.toString(),
    counterparty: payout.recipient,
    title:
      payout.kind === "refund"
        ? "Refund to the payer's chain"
        : payout.kind === "payroll"
          ? `Pay to ${payout.symbol} on ${payout.chain}`
          : `To ${payout.symbol} on ${payout.chain}`,
    receiptUrl:
      payout.kind === "payroll" && payout.reference
        ? `/r/slip/${payout.reference}`
        : payout.relayId && payout.txHash
          ? `/r/send/${payout.relayId}`
          : null,
    delivered: {
      route: `${payout.symbol} on ${payout.chain}`,
      coin: payout.symbol.toLowerCase(),
      chainMark: CHAIN_MARK[payout.chain] ?? "unknown",
      amountOut: payout.amountOutFormatted ?? quote?.quote.amountOutFormatted ?? null,
      txUrl: null,
    },
  }
  const to = await ownerAddress(db, workspace.id)
  if (payout.status === "delivered")
    await queueEmail(db, {
      event: { kind: "payout.delivered", data },
      to,
      dedupe: `payout.delivered:${payout.id}`,
      workspaceId: workspace.id,
    })
  else
    await queueEmail(db, {
      event: {
        kind: "payout.returned",
        data: { ...data, reason: payout.error ?? "NEAR Intents couldn't complete it." },
      },
      to,
      dedupe: `payout.returned:${payout.id}`,
      workspaceId: workspace.id,
    })
}

const CHAIN_MARK: Record<string, string> = {
  Tron: "tron",
  Base: "base",
  Ethereum: "eth",
  Solana: "sol",
  Arbitrum: "arb",
  Bitcoin: "btc",
  "BNB Chain": "bnb",
  Polygon: "pol",
  Gnosis: "gnosis",
}

/** A referral reward was paid: the business it was paid to hears it. */
export async function queueReferralEmail(db: Db, payoutId: string) {
  const [row] = await db
    .select({ payout: referralPayouts, referral: referrals })
    .from(referralPayouts)
    .innerJoin(referrals, eq(referrals.id, referralPayouts.referralId))
    .where(and(eq(referralPayouts.id, payoutId), eq(referralPayouts.status, "sent")))
  if (!row) return
  const receiver = await accountEmail(db, row.payout.accountId)
  const otherUser =
    row.payout.side === "referrer" ? row.referral.refereeId : row.referral.referrerId
  const [[mine], [other]] = await Promise.all([
    db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, receiver?.userId ?? otherUser)),
    db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.ownerId, otherUser)),
  ])
  if (!mine) return
  const data = {
    ...moveBase(mine, row.referral.network, row.payout.updatedAt, row.payout.txHash),
    business: mine.name,
    amount: row.payout.amount.toString(),
    counterparty: row.payout.accountId,
    title:
      row.payout.side === "referrer"
        ? `Referral reward for inviting ${other?.name ?? "a business"}`
        : `Referral reward for joining through ${other?.name ?? "an invite"}`,
    receiptUrl: `/r/reward/${row.payout.id}`,
    other:
      row.payout.side === "referrer"
        ? `${other?.name ?? "A business you invited"} got paid with your link`
        : `you joined through ${other?.name ?? "an invite"}`,
  }
  await queueEmail(db, {
    event: { kind: "referral.paid", data },
    to: (await ownerAddress(db, mine.id)) ?? receiver?.email,
    dedupe: `referral.paid:${row.payout.id}`,
    workspaceId: mine.id,
  })
}

// --- payroll -------------------------------------------------------------------------------------------------------

const CADENCE: Record<string, string> = {
  weekly: "a week",
  fortnightly: "every two weeks",
  monthly: "a month",
}

/** "Added you to payroll" (or a reminder to choose where pay lands). */
export async function queueInviteEmail(
  db: Db,
  personId: string,
  options: { cadence?: string | null; again?: string } = {},
) {
  const [row] = await db
    .select({ person: people, workspace: workspaces })
    .from(people)
    .innerJoin(workspaces, eq(workspaces.id, people.workspaceId))
    .where(and(eq(people.id, personId), eq(people.status, "active")))
  if (!row?.person.email) return
  await queueEmail(db, {
    event: {
      kind: "payroll.invite",
      data: {
        business: row.workspace.name,
        logo: logoPath(row.workspace),
        person: row.person.name,
        role: row.person.role,
        amount: row.person.amount.toString(),
        cadence: options.cadence ? (CADENCE[options.cadence] ?? "each payday") : "each payday",
        url: `/p/${row.person.token}`,
        sandbox: sandbox(row.person.network),
        reminder: Boolean(options.again),
      },
    },
    to: row.person.email,
    dedupe: `payroll.invite:${personId}:${options.again ?? "first"}`,
    workspaceId: row.workspace.id,
  })
}

const periodLabel = (from: string, to: string) => {
  const f = new Date(`${from}T12:00:00Z`)
  const t = new Date(`${to}T12:00:00Z`)
  const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" })
  const monthYear = t.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
  return `Pay · ${day(f)}–${day(t)} ${monthYear}`
}

/**
 * A run finished (by approval or by autopilot): every paid person gets their payslip, and the business hears how it
 * went. Safe to call more than once and from any path that settles a run (relay, keeper, start-up sweep).
 */
export async function queueRunEmails(db: Db, runId: string) {
  const [run] = await db.select().from(payRuns).where(eq(payRuns.id, runId))
  if (!run || (run.status !== "paid" && run.status !== "failed")) return
  const workspace = await workspaceOf(db, run.workspaceId)
  if (!workspace) return
  const rows = await db
    .select({ row: payRows, email: people.email })
    .from(payRows)
    .innerJoin(people, eq(people.id, payRows.personId))
    .where(and(eq(payRows.runId, run.id), inArray(payRows.status, ["paid", "failed"])))
  const autopilot = run.source === "autopilot"
  const paid = rows.filter((r) => r.row.status === "paid")
  for (const { row, email } of paid) {
    await queueEmail(db, {
      event: {
        kind: "payroll.paid",
        data: {
          ...moveBase(workspace, run.network, row.paidAt ?? run.updatedAt, row.txHash),
          person: row.name,
          amount: row.amount.toString(),
          period: periodLabel(run.periodFrom, run.periodTo),
          account: row.accountId ?? "",
          url: `/r/slip/${row.id}`,
          autopilot,
        },
      },
      to: email,
      dedupe: `payroll.paid:${row.id}`,
      workspaceId: workspace.id,
    })
  }
  const total = paid.reduce((sum, r) => sum + r.row.amount, 0n)
  await queueEmail(db, {
    event: {
      kind: "payroll.run",
      data: {
        business: workspace.name,
        sandbox: sandbox(run.network),
        status: run.status === "paid" ? "paid" : "failed",
        paid: paid.length,
        failed: rows.length - paid.length,
        total: total.toString(),
        payday: run.payday,
        url: `/app/payroll/runs/${run.id}`,
        autopilot,
      },
    },
    to: await ownerAddress(db, workspace.id),
    dedupe: `payroll.run:${run.id}:${run.attempt}:${run.status}`,
    workspaceId: workspace.id,
  })
}

/** "T9yD…3kPq": an address on another chain, short enough for a sentence. */
const shortAddress = (address: string) =>
  address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address

/**
 * Where a person's pay lands changed. A change the person made waits 24 hours: both they and the business are told
 * (that wait exists so someone notices). A destination the owner set is told to the person.
 */
export async function queueDestinationEmails(db: Db, destinationId: string) {
  const [row] = await db
    .select({ destination: personDestinations, person: people, workspace: workspaces })
    .from(personDestinations)
    .innerJoin(people, eq(people.id, personDestinations.personId))
    .innerJoin(workspaces, eq(workspaces.id, people.workspaceId))
    .where(eq(personDestinations.id, destinationId))
  if (!row) return
  const { destination, person, workspace } = row
  const where =
    destination.kind === "near"
      ? (destination.accountId ?? "a NEAR account")
      : destination.kind === "chain"
        ? `${routeLabel(destination.route) ?? "another chain"} at ${shortAddress(destination.accountId ?? "")}`
        : `their Tegata account (.${NETWORKS[person.network].operator})`
  const base = { business: workspace.name, sandbox: sandbox(person.network), person: person.name }
  if (destination.setBy === "owner") {
    await queueEmail(db, {
      event: {
        kind: "destination.set",
        data: { ...base, destination: where, url: `/p/${person.token}` },
      },
      to: person.email,
      dedupe: `destination.set:${destination.id}`,
      workspaceId: workspace.id,
    })
    return
  }
  if (destination.activatesAt.getTime() <= destination.createdAt.getTime() + 60_000) return
  const pending = {
    ...base,
    destination: where,
    activatesAt: destination.activatesAt.toISOString(),
    timezone: workspace.timezone,
  }
  await queueEmail(db, {
    event: {
      kind: "destination.pending",
      data: { ...pending, url: `/p/${person.token}`, to: "person" },
    },
    to: person.email,
    dedupe: `destination.pending:${destination.id}:person`,
    workspaceId: workspace.id,
  })
  await queueEmail(db, {
    event: { kind: "destination.pending", data: { ...pending, url: "/app/people", to: "owner" } },
    to: await ownerAddress(db, workspace.id),
    dedupe: `destination.pending:${destination.id}:owner`,
    workspaceId: workspace.id,
  })
}

// --- the account ---------------------------------------------------------------------------------------------------

/** An account finished opening: a welcome in the Sandbox, "Live is on" for a mainnet account. */
export async function queueAccountEmail(db: Db, accountRowId: string) {
  const [row] = await db
    .select({ account: accounts, workspace: workspaces })
    .from(accounts)
    .innerJoin(workspaces, eq(workspaces.ownerId, accounts.userId))
    .where(eq(accounts.id, accountRowId))
  if (!row?.account.readyAt) return
  const live = row.account.network === "mainnet"
  await queueEmail(db, {
    event: {
      kind: live ? "account.live" : "account.welcome",
      data: {
        business: row.workspace.name,
        accountId: row.account.accountId,
        sandbox: !live,
        url: live ? "/app/links" : "/app/invoices/new",
      },
    },
    to: await ownerAddress(db, row.workspace.id),
    dedupe: `account:${row.account.id}`,
    workspaceId: row.workspace.id,
  })
}

// --- autopilot -----------------------------------------------------------------------------------------------------

/** Payday came and the money set aside didn't cover it: nothing was paid, and the owner is told what's short. */
export async function queueAutopilotUnderfunded(db: Db, autopilotId: string) {
  const [plan] = await db
    .select()
    .from(schema.autopilotPlans)
    .where(eq(schema.autopilotPlans.id, autopilotId))
  const short = plan?.underfunded
  if (!plan || !short) return
  const workspace = await workspaceOf(db, plan.workspaceId)
  if (!workspace) return
  await queueEmail(db, {
    event: {
      kind: "autopilot.underfunded",
      data: {
        business: workspace.name,
        sandbox: sandbox(plan.network),
        needed: short.needed,
        available: short.available,
        payday: short.payday,
        url: "/app/payroll",
      },
    },
    to: await ownerAddress(db, workspace.id),
    dedupe: `autopilot.underfunded:${plan.id}:${short.payday}`,
    workspaceId: workspace.id,
  })
}

/** Autopilot turned on: what it pays, how much is set aside, and the paydays it covers. */
export async function queueAutopilotOn(db: Db, autopilotId: string) {
  const [plan] = await db
    .select()
    .from(schema.autopilotPlans)
    .where(eq(schema.autopilotPlans.id, autopilotId))
  if (plan?.status !== "on") return
  const workspace = await workspaceOf(db, plan.workspaceId)
  if (!workspace) return
  await queueEmail(db, {
    event: {
      kind: "autopilot.on",
      data: {
        business: workspace.name,
        sandbox: sandbox(plan.network),
        people: plan.rows.length,
        setAside: plan.setAside.toString(),
        paydays: plan.paydays.slice(0, 3),
        url: "/app/payroll",
      },
    },
    to: await ownerAddress(db, workspace.id),
    dedupe: `autopilot.on:${plan.id}`,
    workspaceId: workspace.id,
  })
}

// --- invoices ------------------------------------------------------------------------------------------------------

/**
 * An invoice email to its customer: sent (the PDF is attached when it goes out), a reminder, cancelled, or marked
 * paid by hand. A reminder after the due date also tells the owner it's overdue.
 */
export async function queueInvoiceEmail(
  db: Db,
  invoiceId: string,
  kind: "invoice.sent" | "invoice.reminder" | "invoice.void" | "invoice.paid_by_hand",
  options: {
    offset?: number
    amount?: bigint
    note?: string | null
    /** The payment marked by hand, for its receipt link. */
    paymentId?: string
  } = {},
) {
  const [row] = await db
    .select({ token: requests.token, workspaceId: invoices.workspaceId })
    .from(invoices)
    .innerJoin(requests, eq(requests.id, invoices.requestId))
    .where(eq(invoices.id, invoiceId))
  if (!row) return
  const docs = await invoiceDocuments(db, row.token, "")
  const workspace = await workspaceOf(db, row.workspaceId)
  if (!docs || !workspace) return
  const data = { ...docs.email, logo: logoPath(workspace), invoiceId, offset: options.offset }
  const dedupe =
    kind === "invoice.sent"
      ? `invoice.sent:${invoiceId}`
      : kind === "invoice.reminder"
        ? `invoice.reminder:${invoiceId}:${options.offset ?? 0}`
        : kind === "invoice.void"
          ? `invoice.void:${invoiceId}`
          : `invoice.paid_by_hand:${invoiceId}:${options.paymentId ?? Date.now()}`
  const [receipt] = options.paymentId
    ? await db
        .select({ token: receipts.token })
        .from(receipts)
        .where(eq(receipts.paymentId, options.paymentId))
    : []
  if (kind === "invoice.paid_by_hand")
    await queueEmail(db, {
      event: {
        kind,
        data: {
          ...data,
          amount: (options.amount ?? 0n).toString(),
          note: options.note ?? null,
          receiptUrl: receipt ? `/r/${receipt.token}` : null,
        },
      },
      to: docs.to,
      dedupe,
      workspaceId: workspace.id,
    })
  else
    await queueEmail(db, { event: { kind, data }, to: docs.to, dedupe, workspaceId: workspace.id })
  if (kind === "invoice.reminder" && (options.offset ?? 0) > 0)
    await queueEmail(db, {
      event: {
        kind: "invoice.overdue",
        data: {
          ...data,
          ownerUrl: `/app/invoices/${invoiceId}`,
          daysLate: options.offset ?? 0,
        },
      },
      to: await ownerAddress(db, workspace.id),
      dedupe: `invoice.overdue:${invoiceId}:${options.offset}`,
      workspaceId: workspace.id,
    })
}

// --- developers ----------------------------------------------------------------------------------------------------

/** A new API key (a security notice: it always goes). */
export async function queueApiKeyEmail(
  db: Db,
  key: { id: string; workspaceId: string; network: NetworkId; name: string; prefix: string },
) {
  const workspace = await workspaceOf(db, key.workspaceId)
  if (!workspace) return
  await queueEmail(db, {
    event: {
      kind: "apikey.created",
      data: {
        business: workspace.name,
        sandbox: sandbox(key.network),
        name: key.name,
        prefix: key.prefix,
        url: "/app/developers",
      },
    },
    to: await ownerAddress(db, workspace.id),
    dedupe: `apikey.created:${key.id}`,
    workspaceId: workspace.id,
  })
}

/** A webhook gave up after its last try. At most one email per endpoint per day. */
export async function queueWebhookFailing(db: Db, deliveryId: string) {
  const [row] = await db
    .select({
      delivery: schema.webhookDeliveries,
      endpoint: schema.webhookEndpoints,
      event: schema.events,
    })
    .from(schema.webhookDeliveries)
    .innerJoin(
      schema.webhookEndpoints,
      eq(schema.webhookEndpoints.id, schema.webhookDeliveries.endpointId),
    )
    .innerJoin(schema.events, eq(schema.events.id, schema.webhookDeliveries.eventId))
    .where(eq(schema.webhookDeliveries.id, deliveryId))
  if (!row) return
  const workspace = await workspaceOf(db, row.endpoint.workspaceId)
  if (!workspace) return
  let host = row.endpoint.url
  try {
    host = new URL(row.endpoint.url).host
  } catch {}
  await queueEmail(db, {
    event: {
      kind: "webhook.failing",
      data: {
        business: workspace.name,
        sandbox: sandbox(row.endpoint.network),
        endpoint: host,
        event: row.event.type,
        tries: row.delivery.attempts,
        url: "/app/developers",
      },
    },
    to: await ownerAddress(db, workspace.id),
    dedupe: `webhook.failing:${row.endpoint.id}:${new Date().toISOString().slice(0, 10)}`,
    workspaceId: workspace.id,
  })
}

// --- the books and paydays (daily and monthly) ---------------------------------------------------------------------

/** Last month's statement for every business that had movements, with its PDF attached when it goes out. */
export async function queueStatements(db: Db, month: string, network: NetworkId) {
  const owners = await db
    .select({ workspace: workspaces })
    .from(workspaces)
    .innerJoin(
      accounts,
      and(eq(accounts.userId, workspaces.ownerId), eq(accounts.network, network)),
    )
  for (const { workspace } of owners) {
    const { from, to } = monthRange(month, workspace.timezone)
    const list = await movements(db, {
      userId: workspace.ownerId,
      workspaceId: workspace.id,
      network,
      from,
      to,
    })
    if (!list.length) continue
    const t = totals(list)
    await queueEmail(db, {
      event: {
        kind: "statement.monthly",
        data: {
          business: workspace.name,
          sandbox: sandbox(network),
          month,
          label: new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }),
          moneyIn: t.moneyIn.toString(),
          moneyOut: t.moneyOut.toString(),
          net: t.net.toString(),
          count: list.length,
          url: `/app/activity`,
        },
      },
      to: await ownerAddress(db, workspace.id),
      dedupe: `statement.monthly:${workspace.id}:${network}:${month}`,
      workspaceId: workspace.id,
    })
  }
}

/** Payday is today or past and no run exists for it: the owner is asked to review and approve. Once per payday. */
export async function queuePayrollDue(db: Db) {
  const schedules = await db.select().from(schema.payrolls)
  for (const schedule of schedules) {
    const workspace = await workspaceOf(db, schedule.workspaceId)
    if (!workspace) continue
    const due = await payrollDue(db, schedule.workspaceId, schedule.network, workspace.timezone)
    if (!due?.people) continue
    await queueEmail(db, {
      event: {
        kind: "payroll.due",
        data: {
          business: workspace.name,
          sandbox: sandbox(schedule.network),
          people: due.people,
          total: due.total.toString(),
          payday: due.payday,
          url: "/app/payroll",
        },
      },
      to: await ownerAddress(db, workspace.id),
      dedupe: `payroll.due:${workspace.id}:${schedule.network}:${due.payday}`,
      workspaceId: workspace.id,
    })
  }
}

/** Both sides of a referral that was just paid. */
export async function queueReferralEmails(db: Db, referralId: string) {
  const sent = await db
    .select({ id: referralPayouts.id })
    .from(referralPayouts)
    .where(and(eq(referralPayouts.referralId, referralId), eq(referralPayouts.status, "sent")))
  for (const payout of sent) await queueReferralEmail(db, payout.id)
}

/** People skipped from a run because they haven't chosen where pay lands get a reminder (once per run). */
export async function queueSkippedReminders(db: Db, runId: string) {
  const skipped = await db
    .select({ personId: payRows.personId })
    .from(payRows)
    .where(and(eq(payRows.runId, runId), eq(payRows.status, "skipped")))
  const [run] = await db.select().from(payRuns).where(eq(payRuns.id, runId))
  const [schedule] = run
    ? await db
        .select({ cadence: schema.payrolls.cadence })
        .from(schema.payrolls)
        .where(
          and(
            eq(schema.payrolls.workspaceId, run.workspaceId),
            eq(schema.payrolls.network, run.network),
          ),
        )
    : []
  for (const { personId } of skipped) {
    const [row] = await db
      .select({ kind: personDestinations.kind })
      .from(personDestinations)
      .where(eq(personDestinations.personId, personId))
      .limit(1)
    // Only those who have no destination at all; one still opening needs nothing from them.
    if (!row)
      await queueInviteEmail(db, personId, { cadence: schedule?.cadence, again: `run:${runId}` })
  }
}

// --- referrals -----------------------------------------------------------------------------------------------------

/** A business joined through someone's link: the referrer hears it, with the rule for the reward. */
export async function queueReferralJoined(db: Db, referralId: string) {
  const [referral] = await db.select().from(referrals).where(eq(referrals.id, referralId))
  if (!referral) return
  const [[referrer], [referee]] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.ownerId, referral.referrerId)),
    db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.ownerId, referral.refereeId)),
  ])
  if (!referrer) return
  const rule = REFERRALS[referral.network]
  await queueEmail(db, {
    event: {
      kind: "referral.joined",
      data: {
        business: referrer.name,
        joined: referee?.name ?? "A business",
        sandbox: sandbox(referral.network),
        threshold: rule.threshold.toString(),
        reward: rule.reward.toString(),
        url: "/app/refer",
      },
    },
    to: await ownerAddress(db, referrer.id),
    dedupe: `referral.joined:${referral.id}`,
    workspaceId: referrer.id,
  })
}

/** Referrals that qualified in the last hour: both businesses hear the reward is coming (once each). */
export async function queueReferralsQualified(db: Db) {
  const recent = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.status, "qualified"),
        gte(referrals.qualifiedAt, new Date(Date.now() - 3_600_000)),
      ),
    )
  for (const referral of recent) {
    const sides = [
      { me: referral.referrerId, other: referral.refereeId, side: "referrer" },
      { me: referral.refereeId, other: referral.referrerId, side: "referee" },
    ]
    for (const { me, other, side } of sides) {
      const [[mine], [theirs]] = await Promise.all([
        db.select().from(workspaces).where(eq(workspaces.ownerId, me)),
        db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.ownerId, other)),
      ])
      if (!mine) continue
      await queueEmail(db, {
        event: {
          kind: "referral.qualified",
          data: {
            business: mine.name,
            other: theirs?.name ?? "your referral",
            sandbox: sandbox(referral.network),
            reward: REFERRALS[referral.network].reward.toString(),
            payAt: (referral.payoutAfter ?? new Date()).toISOString(),
            url: "/app/refer",
          },
        },
        to: await ownerAddress(db, mine.id),
        dedupe: `referral.qualified:${referral.id}:${side}`,
        workspaceId: mine.id,
      })
    }
  }
}

// --- bank ----------------------------------------------------------------------------------------------------------

/** A withdrawal to a bank finished: paid (with what the account received), or failed and returned. */
export async function queueBankPayoutEmail(db: Db, payoutId: string) {
  const [row] = await db
    .select({ payout: schema.bankPayouts, label: schema.bankPayoutAccounts.label })
    .from(schema.bankPayouts)
    .innerJoin(
      schema.bankPayoutAccounts,
      eq(schema.bankPayoutAccounts.id, schema.bankPayouts.payoutAccountId),
    )
    .where(eq(schema.bankPayouts.id, payoutId))
  if (!row || (row.payout.status !== "paid" && row.payout.status !== "failed")) return
  const workspace = await workspaceOf(db, row.payout.workspaceId)
  if (!workspace) return
  const paid = row.payout.status === "paid"
  await queueEmail(db, {
    event: {
      kind: paid ? "bank.paid" : "bank.failed",
      data: {
        ...moveBase(
          workspace,
          row.payout.network,
          row.payout.paidAt ?? row.payout.updatedAt,
          row.payout.nearTx,
        ),
        amount: row.payout.amount.toString(),
        account: row.label,
        fiat: row.payout.fiat,
        fiatAmount: row.payout.fiatAmount,
        rate: row.payout.rate,
        reason: row.payout.error,
        url: "/app/bank",
      },
    },
    to: await ownerAddress(db, workspace.id),
    dedupe: `bank.${row.payout.status}:${row.payout.id}`,
    workspaceId: workspace.id,
  })
}

/** Money that arrived by bank transfer was credited to the business's USDC on NEAR. */
export async function queueBankDepositEmail(db: Db, depositId: string) {
  const [deposit] = await db
    .select()
    .from(schema.bankDeposits)
    .where(eq(schema.bankDeposits.id, depositId))
  if (deposit?.status !== "credited") return
  const workspace = await workspaceOf(db, deposit.workspaceId)
  if (!workspace) return
  await queueEmail(db, {
    event: {
      kind: "bank.received",
      data: {
        ...moveBase(workspace, deposit.network, deposit.updatedAt, deposit.creditTx),
        amount: deposit.amount.toString(),
        fiat: deposit.fiat,
        fiatAmount: deposit.fiatAmount,
        url: "/app/bank",
      },
    },
    to: await ownerAddress(db, workspace.id),
    dedupe: `bank.received:${deposit.id}`,
    workspaceId: workspace.id,
  })
}
