// Books on the server: a month of movements shaped for the screen, the CSV an accountant opens, and the statement.
import type { NetworkId } from "@tegata/config"
import { localToday } from "@tegata/core/invoices"
import { explorerTx } from "@tegata/core/near"
import type { StatementDocument } from "@tegata/documents"
import { type Movement, monthRange, monthStatement, movements, totals } from "@tegata/services"

import type { BooksMonth, MovementView } from "@/lib/client/types"

import { db } from "./context.ts"
import { badRequest } from "./http.ts"
import { routeOfAsset } from "./oneclick.ts"

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export function parseMonth(month: string | null, timezone: string): string {
  if (!month) return localToday(timezone).slice(0, 7)
  if (!MONTH.test(month)) throw badRequest("A month looks like 2026-11")
  return month
}

export const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

const view = (m: Movement): MovementView => ({
  id: m.id,
  kind: m.kind,
  direction: m.direction,
  at: m.at.toISOString(),
  amount: m.amount.toString(),
  title: m.title,
  counterparty: m.counterparty,
  counterpartyAccount: m.counterpartyAccount,
  status: m.status,
  txHash: m.txHash,
  explorerUrl: m.txHash ? explorerTx(m.network, m.txHash) : null,
  url: m.url,
  counted: m.counted,
  refunded: m.refunded.toString(),
  rail: m.rail ?? null,
  assetIn: m.assetIn ?? null,
  fiat: m.fiat ?? null,
  fiatAmount: m.fiatAmount ?? null,
  refundable: m.refundable && {
    ...m.refundable,
    left: m.refundable.left.toString(),
    route: null,
  },
})

/** A refund to another chain names the payer's coin and chain, read from 1Click's token list. */
async function withRoutes(list: MovementView[]): Promise<MovementView[]> {
  return Promise.all(
    list.map(async (m) => {
      if (m.refundable?.rail !== "oneclick" || !m.refundable.assetIn) return m
      const found = await routeOfAsset(m.refundable.assetIn).catch(() => null)
      if (!found) return { ...m, refundable: null }
      const { id, symbol, chain, coin, chainMark } = found.route
      return {
        ...m,
        refundable: { ...m.refundable, route: { id, symbol, chain, coin, chainMark } },
      }
    }),
  )
}

export async function monthOf(
  user: { id: string },
  workspace: { id: string; timezone: string },
  month: string,
  network: NetworkId,
) {
  const { from, to } = monthRange(month, workspace.timezone)
  const list = await movements(db(), {
    userId: user.id,
    workspaceId: workspace.id,
    network: network,
    from,
    to,
  })
  return { list, totals: totals(list) }
}

export async function booksView(
  user: { id: string },
  workspace: { id: string; timezone: string },
  month: string,
  network: NetworkId,
): Promise<BooksMonth> {
  const { list, totals: t } = await monthOf(user, workspace, month, network)
  return {
    month,
    label: monthName(month),
    timezone: workspace.timezone,
    moneyIn: t.moneyIn.toString(),
    moneyOut: t.moneyOut.toString(),
    net: t.net.toString(),
    movements: await withRoutes(list.map(view)),
  }
}

const KIND_WORD: Record<Movement["kind"], string> = {
  payment_in: "Payment received",
  payment_out: "Payment made",
  send: "Sent",
  refund: "Refund",
  reward: "Referral reward",
  test_dollars: "Test dollars",
  payroll: "Payroll",
  payslip: "Pay received",
  autopilot_set_aside: "Set aside in autopilot",
  autopilot_back: "Back from autopilot",
  bank_out: "Withdrawn to a bank",
  bank_in: "Received by bank transfer",
}

/** A cell a spreadsheet can't run: quoted, and a leading = + - @ neutralised. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

const dollars = (units: bigint) => {
  const whole = units / 1_000_000n
  const cents = ((units % 1_000_000n) / 10_000n).toString().padStart(2, "0")
  return `${whole}.${cents}`
}

function partsIn(at: Date, timezone: string) {
  const date = at.toLocaleDateString("en-CA", { timeZone: timezone })
  const time = at.toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  })
  return { date, time }
}

export function booksCsv(list: readonly Movement[], timezone: string, appUrl: string): string {
  const header = [
    "Date",
    "Time",
    "Type",
    "Description",
    "Counterparty",
    "Counterparty account",
    "Money in",
    "Money out",
    "Currency",
    "Status",
    "Receipt",
    "NEAR transaction",
  ]
  const rows = [...list].reverse().map((m) => {
    const { date, time } = partsIn(m.at, timezone)
    return [
      date,
      time,
      KIND_WORD[m.kind],
      m.counted ? m.title : `${m.title} (paid from money already set aside)`,
      m.counterparty ?? "",
      m.counterpartyAccount ?? "",
      m.direction === "in" ? dollars(m.amount) : "",
      m.direction === "out" ? dollars(m.amount) : "",
      "USD",
      m.status === "done" ? "Settled" : m.status === "pending" ? "Pending" : "Failed",
      m.url && !m.url.startsWith("/app") ? `${appUrl}${m.url}` : "",
      m.txHash ? explorerTx(m.network, m.txHash) : "",
    ]
  })
  return `\uFEFF${[header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`
}

export async function statementDocument(
  _user: { id: string },
  workspace: { id: string },
  month: string,
  network: NetworkId,
): Promise<StatementDocument> {
  const doc = await monthStatement(db(), workspace.id, month, network)
  if (!doc) throw badRequest("No such business")
  return doc
}
