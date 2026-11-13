// Books (plan 6.8 U–X): one list of every movement that touched a business's dollars in a month, which feeds Activity,
// the CSV and the statement; the refund of a received payment; and reconciliation of the books against NEAR.
import { NETWORKS, type NetworkId } from "@tegata/config"
import { atLocal } from "@tegata/core/invoices"
import { type DelegateDraft, ftTransfer, usdcBalance } from "@tegata/core/near"
import { periodLabel } from "@tegata/core/payroll"
import { type Db, schema } from "@tegata/db"
import { and, eq, gte, inArray, like, lt, or, sql } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

import { businessLogo } from "./business.ts"
import { queueRefundEmails } from "./emails.ts"
import { type Conn, emitEvent, paymentObject } from "./events.ts"
import { PayrollError } from "./payroll.ts"
import { createRelayDraft } from "./relays.ts"

const {
  payments,
  requests,
  receipts,
  relays,
  workspaces,
  referralPayouts,
  referrals,
  accounts,
  testDollars,
  payRuns,
  payRows,
  people,
  payouts,
} = schema

export type MovementKind =
  | "payment_in"
  | "payment_out"
  | "send"
  | "refund"
  | "reward"
  | "test_dollars"
  | "payroll"
  | "payslip"
  | "autopilot_set_aside"
  | "autopilot_back"

export interface Movement {
  id: string
  kind: MovementKind
  direction: "in" | "out"
  at: Date
  /** USDC base units. */
  amount: bigint
  title: string
  counterparty: string | null
  counterpartyAccount: string | null
  status: "done" | "pending" | "failed"
  network: NetworkId
  txHash: string | null
  /** The page it opens: a receipt, a run, a payslip. */
  url: string | null
  /** Shown, but not in the totals: an autopilot payroll moved money already set aside, not the balance. */
  counted: boolean
  /**
   * A received payment that can still be refunded, and how much is left: on NEAR to the account that paid, or (paid
   * from another chain) to the payer's own address in the coin they sent, through NEAR Intents.
   */
  refundable: {
    paymentId: string
    left: bigint
    payer: string
    rail: "tegata" | "near_wallet" | "oneclick"
    /** The 1Click asset the payer sent, for a refund to another chain. */
    assetIn: string | null
  } | null
  refunded: bigint
}

const SPONSORED = ["signed", "sent", "unknown", "success"] as const
const relayStatus = (status: string): Movement["status"] =>
  status === "success" ? "done" : status === "failed" || status === "expired" ? "failed" : "pending"

/** The first USDC transfer a relay carries: who it went to and how much. */
function transferOf(draft: unknown): { to: string; amount: bigint } | null {
  const call = (draft as DelegateDraft).calls?.[0]
  if (!call) return null
  const args = JSON.parse(call.argsJson) as { receiver_id?: string; amount?: string }
  return args.receiver_id && args.amount
    ? { to: args.receiver_id, amount: BigInt(args.amount) }
    : null
}

/** A month (`YYYY-MM`) as instants, in the business's own time zone. */
export function monthRange(month: string, timezone: string) {
  const [year, m] = month.split("-").map(Number) as [number, number]
  const from = atLocal({ year, month: m, day: 1 }, 0, timezone)
  const to = atLocal(
    m === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: m + 1, day: 1 },
    0,
    timezone,
  )
  return { from, to }
}

/** Every movement for this business and its owner in [from, to), newest first. */
export async function movements(
  db: Db,
  input: { userId: string; workspaceId: string; network: NetworkId; from: Date; to: Date },
): Promise<Movement[]> {
  const { userId, workspaceId, network, from, to } = input
  const inRange = (column: AnyPgColumn) => and(gte(column, from), lt(column, to))
  const operator = NETWORKS[network].operator
  const [paidIn, paidOut, ownRelays, rewards, grants, runs, slips, chainPayouts] =
    await Promise.all([
      db
        .select({ payment: payments, title: requests.title, receiptToken: receipts.token })
        .from(payments)
        .innerJoin(requests, eq(requests.id, payments.requestId))
        .leftJoin(receipts, eq(receipts.paymentId, payments.id))
        .where(
          and(
            eq(requests.workspaceId, workspaceId),
            eq(payments.network, network),
            inArray(payments.status, ["succeeded", "refunded"]),
            inRange(payments.settledAt),
          ),
        ),
      db
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
            eq(payments.network, network),
            inArray(payments.status, ["detected", "settling", "succeeded", "refunded", "failed"]),
            inRange(payments.createdAt),
          ),
        ),
      db
        .select()
        .from(relays)
        .where(
          and(
            eq(relays.userId, userId),
            eq(relays.network, network),
            inArray(relays.status, [...SPONSORED, "failed"]),
            inRange(relays.createdAt),
            or(
              like(relays.purpose, "send:%"),
              like(relays.purpose, "refund:%"),
              like(relays.purpose, "autopilot:%"),
            ),
          ),
        ),
      db
        .select({ payout: referralPayouts, network: referrals.network })
        .from(referralPayouts)
        .innerJoin(referrals, eq(referrals.id, referralPayouts.referralId))
        .innerJoin(accounts, eq(accounts.accountId, referralPayouts.accountId))
        .where(
          and(
            eq(accounts.userId, userId),
            eq(referrals.network, network),
            eq(referralPayouts.status, "sent"),
            inRange(referralPayouts.updatedAt),
          ),
        ),
      network === "testnet"
        ? db
            .select()
            .from(testDollars)
            .where(
              and(
                eq(testDollars.userId, userId),
                eq(testDollars.status, "sent"),
                inRange(testDollars.updatedAt),
              ),
            )
        : Promise.resolve([]),
      db
        .select({
          run: payRuns,
          paid: sql<string>`coalesce(sum(${payRows.amount}) filter (where ${payRows.status} = 'paid'), 0)`,
          people: sql<number>`count(*) filter (where ${payRows.status} = 'paid')`,
        })
        .from(payRuns)
        .leftJoin(payRows, eq(payRows.runId, payRuns.id))
        .where(
          and(
            eq(payRuns.workspaceId, workspaceId),
            eq(payRuns.network, network),
            inArray(payRuns.status, ["approved", "paid", "failed"]),
            inRange(payRuns.approvedAt),
          ),
        )
        .groupBy(payRuns.id),
      db
        .select({ row: payRows, run: payRuns, business: workspaces.name })
        .from(payRows)
        .innerJoin(people, eq(people.id, payRows.personId))
        .innerJoin(payRuns, eq(payRuns.id, payRows.runId))
        .innerJoin(workspaces, eq(workspaces.id, payRuns.workspaceId))
        .where(
          and(
            eq(people.userId, userId),
            eq(payRuns.network, network),
            eq(payRows.status, "paid"),
            inRange(payRows.paidAt),
          ),
        ),
      // Live: sends and refunds to another chain (NEAR Intents), once the business approved them.
      db
        .select({ payout: payouts })
        .from(payouts)
        .innerJoin(relays, eq(relays.id, payouts.relayId))
        .where(
          and(
            eq(payouts.workspaceId, workspaceId),
            eq(payouts.network, network),
            inArray(relays.status, [...SPONSORED, "failed"]),
            inRange(payouts.createdAt),
          ),
        ),
    ])

  const list: Movement[] = []
  const base = { network, counted: true, refundable: null, refunded: 0n }

  for (const { payment, title, receiptToken } of paidIn) {
    const left = payment.amount - payment.refunded
    list.push({
      ...base,
      id: payment.id,
      kind: "payment_in",
      direction: "in",
      at: payment.settledAt ?? payment.createdAt,
      amount: payment.amount,
      title,
      counterparty: null,
      counterpartyAccount: payment.payer,
      status: "done",
      txHash: payment.txHash,
      url: receiptToken ? `/r/${receiptToken}` : null,
      refunded: payment.refunded,
      refundable:
        (payment.rail === "tegata" || payment.rail === "near_wallet") && payment.payer && left > 0n
          ? { paymentId: payment.id, left, payer: payment.payer, rail: payment.rail, assetIn: null }
          : payment.rail === "oneclick" && payment.refundTo && payment.assetIn && left > 0n
            ? {
                paymentId: payment.id,
                left,
                payer: payment.refundTo,
                rail: "oneclick" as const,
                assetIn: payment.assetIn,
              }
            : null,
    })
  }
  for (const { payment, title, business, receiptToken } of paidOut) {
    list.push({
      ...base,
      id: payment.id,
      kind: "payment_out",
      direction: "out",
      at: payment.settledAt ?? payment.createdAt,
      amount: payment.amount,
      title: `Paid ${business}: ${title}`,
      counterparty: business,
      counterpartyAccount: payment.receiverId,
      status:
        payment.status === "succeeded" || payment.status === "refunded"
          ? "done"
          : payment.status === "failed"
            ? "failed"
            : "pending",
      txHash: payment.txHash,
      url: receiptToken ? `/r/${receiptToken}` : null,
    })
  }
  for (const { payout } of chainPayouts) {
    const refund = payout.kind === "refund"
    list.push({
      ...base,
      id: payout.id,
      kind: refund ? "refund" : "send",
      direction: "out",
      at: payout.createdAt,
      amount: payout.amount,
      title: refund
        ? `Refund in ${payout.symbol} on ${payout.chain}`
        : `${payout.symbol} on ${payout.chain}`,
      counterparty: null,
      counterpartyAccount: payout.recipient,
      // Done once delivered on the other chain; a payout NEAR Intents returned never left the books.
      status:
        payout.status === "delivered"
          ? "done"
          : payout.status === "refunded" || payout.status === "failed"
            ? "failed"
            : "pending",
      txHash: payout.txHash,
      url: payout.relayId && payout.txHash ? `/r/send/${payout.relayId}` : null,
    })
  }
  for (const relay of ownRelays) {
    const transfer = transferOf(relay.draft)
    const [kind, , step] = relay.purpose.split(":")
    const status = relayStatus(relay.status)
    if (kind === "send" && transfer) {
      list.push({
        ...base,
        id: relay.id,
        kind: "send",
        direction: "out",
        at: relay.createdAt,
        amount: transfer.amount,
        title: "One-off payment",
        counterparty: null,
        counterpartyAccount: transfer.to,
        status,
        txHash: relay.txHash,
        url: status === "failed" ? null : `/r/send/${relay.id}`,
      })
    } else if (kind === "refund" && transfer) {
      list.push({
        ...base,
        id: relay.id,
        kind: "refund",
        direction: "out",
        at: relay.createdAt,
        amount: transfer.amount,
        title: "Refund",
        counterparty: null,
        counterpartyAccount: transfer.to,
        status,
        txHash: relay.txHash,
        url: status === "failed" ? null : `/r/send/${relay.id}`,
      })
    } else if (
      kind === "autopilot" &&
      (step === "deposit" || step === "add" || step === "withdraw")
    ) {
      const call = (relay.draft as DelegateDraft).calls[0]
      const args = call ? (JSON.parse(call.argsJson) as { amount?: string }) : {}
      list.push({
        ...base,
        id: relay.id,
        kind: step === "withdraw" ? "autopilot_back" : "autopilot_set_aside",
        direction: step === "withdraw" ? "in" : "out",
        at: relay.createdAt,
        amount: BigInt(args.amount ?? "0"),
        title: step === "withdraw" ? "Back from autopilot" : "Set aside in autopilot",
        counterparty: "Autopilot",
        counterpartyAccount: NETWORKS[network].autopilot,
        status,
        txHash: relay.txHash,
        url: "/app/payroll",
      })
    }
  }
  for (const { payout } of rewards) {
    list.push({
      ...base,
      id: payout.id,
      kind: "reward",
      direction: "in",
      at: payout.updatedAt,
      amount: payout.amount,
      title:
        payout.side === "referrer"
          ? "Referral reward: you invited a business"
          : "Referral reward: you joined by invite",
      counterparty: "Tegata",
      counterpartyAccount: operator,
      status: "done",
      txHash: payout.txHash,
      url: `/r/reward/${payout.id}`,
    })
  }
  for (const grant of grants) {
    list.push({
      ...base,
      id: grant.id,
      kind: "test_dollars",
      direction: "in",
      at: grant.updatedAt,
      amount: grant.amount,
      title: "Test dollars (Sandbox)",
      counterparty: "Tegata",
      counterpartyAccount: operator,
      status: "done",
      txHash: grant.txHash,
      url: null,
    })
  }
  for (const { run, paid, people: count } of runs) {
    const label = periodLabel({ from: run.periodFrom, to: run.periodTo })
    const autopilot = run.source === "autopilot"
    list.push({
      ...base,
      id: run.id,
      kind: "payroll",
      direction: "out",
      at: run.paidAt ?? run.approvedAt ?? run.createdAt,
      amount: BigInt(paid),
      title: `Payroll · ${label}${autopilot ? " · by autopilot" : ""}`,
      counterparty: `${count} ${Number(count) === 1 ? "person" : "people"}`,
      counterpartyAccount: null,
      status: run.status === "paid" ? "done" : run.status === "failed" ? "failed" : "pending",
      txHash: run.txHashes[0] ?? null,
      url: `/app/payroll/runs/${run.id}`,
      counted: !autopilot,
    })
  }
  for (const { row, run, business } of slips) {
    list.push({
      ...base,
      id: row.id,
      kind: "payslip",
      direction: "in",
      at: row.paidAt ?? row.updatedAt,
      amount: row.amount,
      title: `Pay from ${business} · ${periodLabel({ from: run.periodFrom, to: run.periodTo })}`,
      counterparty: business,
      counterpartyAccount: run.senderId,
      status: "done",
      txHash: row.txHash,
      url: `/r/slip/${row.id}`,
    })
  }
  return list.sort((a, b) => b.at.getTime() - a.at.getTime())
}

/** Money in and out that moved the balance (autopilot payrolls are shown, not counted: their money was set aside). */
export function totals(list: readonly Movement[]) {
  let moneyIn = 0n
  let moneyOut = 0n
  for (const m of list) {
    if (!m.counted || m.status !== "done") continue
    if (m.direction === "in") moneyIn += m.amount
    else moneyOut += m.amount
  }
  return { moneyIn, moneyOut, net: moneyIn - moneyOut }
}

// --- refunds ----------------------------------------------------------------------------------------------------

/** One gas-free `ft_transfer` back to the account that paid, for all or part of what's left. */
export async function draftRefund(
  db: Db,
  input: {
    workspaceId: string
    userId: string
    publicKey: string
    paymentId: string
    amount: bigint
  },
) {
  const [row] = await db
    .select({ payment: payments, workspaceId: requests.workspaceId })
    .from(payments)
    .innerJoin(requests, eq(requests.id, payments.requestId))
    .where(eq(payments.id, input.paymentId))
  if (row?.workspaceId !== input.workspaceId) throw new PayrollError("not_found", "No such payment")
  const { payment } = row
  if (payment.status !== "succeeded" && payment.status !== "refunded")
    throw new PayrollError("wrong_state", "Only a received payment can be refunded")
  if (payment.rail === "manual")
    throw new PayrollError("bad_input", "Marked paid by hand: refund it the way you were paid")
  if (payment.rail === "oneclick")
    throw new PayrollError("wrong_state", "Paid from another chain: refund it to the payer's chain")
  if (!payment.payer) throw new PayrollError("bad_input", "We don't know which account paid")
  const left = payment.amount - payment.refunded
  if (input.amount <= 0n || input.amount > left)
    throw new PayrollError("bad_input", `Refund up to ${Number(left) / 1e6}`)
  const [owner] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, input.userId), eq(accounts.network, payment.network)))
  if (!owner?.readyAt) throw new PayrollError("not_ready", "Your account is still being set up")
  if ((await usdcBalance(payment.network, owner.accountId)) < input.amount)
    throw new PayrollError("bad_input", "Not enough dollars in your balance for this refund")
  return createRelayDraft(db, {
    userId: input.userId,
    network: payment.network,
    purpose: `refund:${payment.id}:${crypto.randomUUID()}`,
    senderId: owner.accountId,
    receiverId: NETWORKS[payment.network].usdc,
    publicKey: input.publicKey,
    calls: [ftTransfer(payment.payer, input.amount, `tegata:refund:${payment.id}`)],
  })
}

/** How a business's payment was paid (null if it isn't theirs). */
export async function paymentRail(db: Db, workspaceId: string, paymentId: string) {
  const [row] = await db
    .select({ rail: payments.rail })
    .from(payments)
    .innerJoin(requests, eq(requests.id, payments.requestId))
    .where(and(eq(payments.id, paymentId), eq(requests.workspaceId, workspaceId)))
  return row?.rail ?? null
}

/** Worker, after a `refund:` relay lands: add it to the payment; a full refund marks the payment refunded. */
export async function settleRefund(db: Db, relayId: string) {
  const [relay] = await db.select().from(relays).where(eq(relays.id, relayId))
  if (relay?.status !== "success" || !relay.purpose.startsWith("refund:")) return null
  const paymentId = relay.purpose.split(":")[1] ?? ""
  const transfer = transferOf(relay.draft)
  if (!transfer) return null
  // Applied once per relay: the relay's purpose is unique, and a marker in its error column says it's counted.
  if (relay.error === "applied") return null
  return db.transaction(async (tx) => {
    const [marked] = await tx
      .update(relays)
      .set({ error: "applied" })
      .where(and(eq(relays.id, relay.id), sql`${relays.error} is distinct from 'applied'`))
      .returning()
    if (!marked) return null
    return applyRefund(tx, {
      paymentId,
      amount: transfer.amount,
      txHash: relay.txHash,
      dedupe: relay.id,
      receiptUrl: `/r/send/${relay.id}`,
    })
  })
}

/**
 * Count a refund against a payment (inside the caller's transaction, after it has claimed the refund once): add it,
 * mark the payment refunded when nothing is left, and emit `payment.refunded`.
 */
export async function applyRefund(
  tx: Conn,
  input: {
    paymentId: string
    amount: bigint
    txHash: string | null
    dedupe: string
    /** The refund's own receipt. */
    receiptUrl: string | null
  },
) {
  const [payment] = await tx
    .update(payments)
    .set({ refunded: sql`${payments.refunded} + ${input.amount.toString()}` })
    .where(eq(payments.id, input.paymentId))
    .returning()
  if (payment && payment.refunded >= payment.amount)
    await tx.update(payments).set({ status: "refunded" }).where(eq(payments.id, input.paymentId))
  if (payment) {
    const [request] = await tx
      .select({ workspaceId: requests.workspaceId })
      .from(requests)
      .where(eq(requests.id, payment.requestId))
    if (request)
      await emitEvent(tx, {
        workspaceId: request.workspaceId,
        network: payment.network,
        type: "payment.refunded",
        data: {
          ...paymentObject(payment),
          refund_units: input.amount.toString(),
          refund_tx: input.txHash,
        },
        dedupe: `payment.refunded:${input.dedupe}`,
      })
    await queueRefundEmails(tx, input)
  }
  return payment ?? null
}

// --- reconciliation ---------------------------------------------------------------------------------------------

export interface ChainTransfer {
  txHash: string
  at: Date
  /** Signed: positive arrived, negative left. */
  delta: bigint
  other: string
}

const NEARBLOCKS = {
  mainnet: "https://api.nearblocks.io",
  testnet: "https://api-testnet.nearblocks.io",
} as const
const PAGES = 5
const PAGE_SIZE = 100

/** The account's USDC transfers as NearBlocks (v3) indexes them, newest first. */
export async function chainTransfers(
  network: NetworkId,
  accountId: string,
): Promise<ChainTransfer[]> {
  const usdc = NETWORKS[network].usdc
  const out: ChainTransfer[] = []
  let cursor: string | null = null
  for (let page = 0; page < PAGES; page++) {
    const url = new URL(`${NEARBLOCKS[network]}/v3/accounts/${accountId}/ft-txns`)
    url.searchParams.set("limit", String(PAGE_SIZE))
    if (cursor) url.searchParams.set("next", cursor)
    const response = await fetch(url, { headers: { "user-agent": "tegata" } })
    if (!response.ok) throw new Error(`NearBlocks ${response.status}`)
    const body = (await response.json()) as {
      data?: {
        transaction_hash?: string
        block_timestamp: string
        delta_amount: string
        involved_account_id: string | null
        contract_account_id: string
      }[]
      meta?: { next_page?: string | null }
    }
    for (const row of body.data ?? []) {
      if (row.contract_account_id !== usdc || !row.transaction_hash) continue
      out.push({
        txHash: row.transaction_hash,
        at: new Date(Number(BigInt(row.block_timestamp) / 1_000_000n)),
        delta: BigInt(row.delta_amount),
        other: row.involved_account_id ?? "",
      })
    }
    cursor = body.meta?.next_page ?? null
    if (!cursor) break
  }
  return out
}

/** Every transaction hash Tegata's books know for this account (payments, relays, payroll, rewards, test dollars). */
async function knownHashes(db: Db, userId: string, workspaceId: string, accountId: string) {
  const [a, b, c, d, e, f] = await Promise.all([
    db
      .select({ hash: payments.txHash })
      .from(payments)
      .innerJoin(requests, eq(requests.id, payments.requestId))
      .where(eq(requests.workspaceId, workspaceId)),
    db.select({ hash: relays.txHash }).from(relays).where(eq(relays.userId, userId)),
    db.select({ hash: payments.txHash }).from(payments).where(eq(payments.payer, accountId)),
    db
      .select({ hash: referralPayouts.txHash })
      .from(referralPayouts)
      .where(eq(referralPayouts.accountId, accountId)),
    db
      .select({ hash: testDollars.txHash })
      .from(testDollars)
      .where(eq(testDollars.accountId, accountId)),
    db.select({ hash: payRows.txHash }).from(payRows).where(eq(payRows.accountId, accountId)),
  ])
  return new Set([...a, ...b, ...c, ...d, ...e, ...f].flatMap((r) => (r.hash ? [r.hash] : [])))
}

/** The books against NEAR: the balance, and every USDC transfer whose transaction Tegata didn't make or record. */
export async function reconcile(
  db: Db,
  input: { userId: string; workspaceId: string; network: NetworkId },
) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, input.userId), eq(accounts.network, input.network)))
  if (!account) throw new PayrollError("not_ready", "No account on this network yet")
  const [balance, transfers, known] = await Promise.all([
    usdcBalance(input.network, account.accountId),
    chainTransfers(input.network, account.accountId),
    knownHashes(db, input.userId, input.workspaceId, account.accountId),
  ])
  const outside = transfers.filter((t) => !known.has(t.txHash))
  return { accountId: account.accountId, balance, checked: transfers.length, outside }
}

// --- the monthly statement -----------------------------------------------------------------------------------------

const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

function stampIn(at: Date, timezone: string) {
  const date = at.toLocaleDateString("en-CA", { timeZone: timezone })
  const time = at.toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${date} ${time}`
}

/** A month's statement for a business (the PDF's content): every movement, the totals and the balance on NEAR. */
export async function monthStatement(
  db: Db,
  workspaceId: string,
  month: string,
  network: NetworkId,
) {
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId))
  if (!workspace) return null
  const { from, to } = monthRange(month, workspace.timezone)
  const list = await movements(db, {
    userId: workspace.ownerId,
    workspaceId,
    network,
    from,
    to,
  })
  const t = totals(list)
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, workspace.ownerId), eq(accounts.network, network)))
  const balance = account ? await usdcBalance(network, account.accountId) : 0n
  const logo = await businessLogo(db, workspaceId)
  return {
    business: workspace.name,
    address: workspace.address,
    taxId: workspace.taxId,
    logo:
      logo && (logo.type === "image/png" || logo.type === "image/jpeg")
        ? `data:${logo.type};base64,${logo.bytes.toString("base64")}`
        : null,
    month: monthLabel(month),
    timezone: workspace.timezone,
    accountId: account?.accountId ?? "",
    usdc: NETWORKS[network].usdc,
    network,
    moneyIn: t.moneyIn.toString(),
    moneyOut: t.moneyOut.toString(),
    net: t.net.toString(),
    balance: balance.toString(),
    madeAt: stampIn(new Date(), workspace.timezone),
    lines: [...list].reverse().map((m) => ({
      when: stampIn(m.at, workspace.timezone),
      title: m.title,
      counterparty: m.counterparty ?? m.counterpartyAccount ?? "",
      amount: (m.direction === "in" ? m.amount : -m.amount).toString(),
      status: m.status,
      counted: m.counted,
      tx: m.txHash,
    })),
  }
}
