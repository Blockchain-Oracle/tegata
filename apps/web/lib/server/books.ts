// Books on the server: a month of movements shaped for the screen, the CSV an accountant opens, and the statement.
import { NETWORKS, type NetworkId } from "@tegata/config"
import { localToday } from "@tegata/core/invoices"
import { explorerTx, usdcBalance } from "@tegata/core/near"
import type { StatementDocument } from "@tegata/documents"
import {
  accountFor,
  businessLogo,
  type Movement,
  monthRange,
  movements,
  totals,
} from "@tegata/services"

import type { BooksMonth, MovementView } from "@/lib/client/types"

import { db } from "./context.ts"
import { badRequest } from "./http.ts"

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
  refundable: m.refundable && { ...m.refundable, left: m.refundable.left.toString() },
})

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
    movements: list.map(view),
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
  user: { id: string },
  workspace: {
    id: string
    name: string
    timezone: string
    address: string | null
    taxId: string | null
  },
  month: string,
  network: NetworkId,
): Promise<StatementDocument> {
  const { list, totals: t } = await monthOf(user, workspace, month, network)
  const account = await accountFor(db(), user.id, network)
  const balance = account ? await usdcBalance(network, account.accountId) : 0n
  const logo = await businessLogo(db(), workspace.id)
  const now = new Date()
  const stamp = (at: Date) => {
    const { date, time } = partsIn(at, workspace.timezone)
    return `${date} ${time}`
  }
  return {
    business: workspace.name,
    address: workspace.address,
    taxId: workspace.taxId,
    logo:
      logo && (logo.type === "image/png" || logo.type === "image/jpeg")
        ? `data:${logo.type};base64,${logo.bytes.toString("base64")}`
        : null,
    month: monthName(month),
    timezone: workspace.timezone,
    accountId: account?.accountId ?? "",
    usdc: NETWORKS[network].usdc,
    network: network,
    moneyIn: t.moneyIn.toString(),
    moneyOut: t.moneyOut.toString(),
    net: t.net.toString(),
    balance: balance.toString(),
    madeAt: stamp(now),
    lines: [...list].reverse().map((m) => ({
      when: stamp(m.at),
      title: m.title,
      counterparty: m.counterparty ?? m.counterpartyAccount ?? "",
      amount: (m.direction === "in" ? m.amount : -m.amount).toString(),
      status: m.status,
      counted: m.counted,
      tx: m.txHash,
    })),
  }
}
