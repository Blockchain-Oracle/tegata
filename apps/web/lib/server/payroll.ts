// Payroll as the screens see it: the service rows shaped into the client types, with dates as ISO strings and money
// as base-unit strings.
import type { NetworkId } from "@tegata/config"
import { parseDollars } from "@tegata/core/invoices"
import { explorerTx } from "@tegata/core/near"
import { PAYROLL_LIMITS, periodLabel } from "@tegata/core/payroll"
import {
  getRun,
  listRuns,
  nextPaydayFor,
  payslip,
  personPage,
  type TeamMember,
} from "@tegata/services"

import { z } from "zod"

import type { PayRun, PayRunSummary, PersonPage, ReceiptView, TeamPerson } from "@/lib/client/types"

import { chainTxUrl, routeOf } from "@/lib/routes"

import { db } from "./context.ts"
import { badRequest } from "./http.ts"

const iso = (date: Date | null | undefined) => date?.toISOString() ?? null

export function teamPersonView({ person, ready, pending, setBy }: TeamMember): TeamPerson {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    role: person.role,
    amount: person.amount.toString(),
    token: person.token,
    claimed: Boolean(person.userId),
    invitedAt: iso(person.invitedAt),
    ready,
    pending: pending && { ...pending, activatesAt: pending.activatesAt.toISOString() },
    setBy,
  }
}

export async function scheduleView(workspaceId: string, network: NetworkId) {
  const next = await nextPaydayFor(db(), workspaceId, network)
  return next
    ? { cadence: next.schedule.cadence, nextPayday: next.payday, label: periodLabel(next.period) }
    : null
}

export async function runsView(workspaceId: string, network: NetworkId): Promise<PayRunSummary[]> {
  const runs = await listRuns(db(), workspaceId, network)
  return runs.map(({ run, people, label }) => ({
    id: run.id,
    source: run.source,
    payday: run.payday,
    label,
    status: run.status,
    total: run.total.toString(),
    people,
    paidAt: iso(run.paidAt),
  }))
}

export async function runView(workspaceId: string, runId: string): Promise<PayRun> {
  const { run, rows, label } = await getRun(db(), workspaceId, runId)
  return {
    id: run.id,
    source: run.source,
    payday: run.payday,
    label,
    status: run.status,
    total: run.total.toString(),
    attempt: run.attempt,
    error: run.error,
    senderId: run.senderId,
    network: run.network,
    approvedAt: iso(run.approvedAt),
    paidAt: iso(run.paidAt),
    transactions: run.txHashes.map((hash) => ({ hash, url: explorerTx(run.network, hash) })),
    rows: rows.map(({ row, relayStatus }) => ({
      id: row.id,
      personId: row.personId,
      name: row.name,
      role: row.role,
      destinationKind: row.destinationKind,
      accountId: row.accountId,
      route: row.route,
      amount: row.amount.toString(),
      status: row.status,
      skipReason: row.skipReason,
      batch: row.batch,
      relayStatus,
      txHash: row.txHash,
    })),
  }
}

export async function personPageView(token: string): Promise<PersonPage | null> {
  const page = await personPage(db(), token)
  if (!page) return null
  return {
    token,
    name: page.person.name,
    role: page.person.role,
    amount: page.person.amount.toString(),
    cadence: page.cadence,
    business: page.business,
    logo: page.logo,
    network: page.person.network,
    emailHint: page.emailHint,
    claimed: page.claimed,
    ready: page.ready,
    pending: page.pending && {
      ...page.pending,
      activatesAt: page.pending.activatesAt.toISOString(),
    },
    slips: page.slips.map((slip) => ({
      id: slip.id,
      amount: slip.amount.toString(),
      label: slip.label,
      paidAt: iso(slip.paidAt),
    })),
  }
}

/** The payslip as a receipt of kind payslip (plan 6.8 S). */
export async function payslipView(rowId: string): Promise<ReceiptView | null> {
  const slip = await payslip(db(), rowId)
  if (!slip) return null
  const { row, run } = slip
  return {
    kind: "payslip",
    number: null,
    business: slip.business,
    logo: slip.logo,
    title: slip.label,
    amount: row.amount.toString(),
    method: run.source === "autopilot" ? "autopilot" : "payroll",
    payer: run.senderId,
    payerName: slip.business,
    receiverName: row.name,
    receiverId: row.accountId ?? "",
    network: run.network,
    settledAt: iso(row.paidAt),
    feeBy: "tegata",
    txHash: row.txHash,
    explorerUrl: row.txHash ? explorerTx(run.network, row.txHash) : null,
    // Paid to another chain: what NEAR Intents delivered, where, and that chain's transaction once it's there.
    deliveredAs: slip.payout
      ? (() => {
          const route = routeOf(slip.payout.symbol, slip.payout.chain)
          return {
            route: `${slip.payout.symbol} on ${slip.payout.chain}`,
            coin: route?.coin ?? "unknown",
            chainMark: route?.chainMark ?? "unknown",
            amount: slip.payout.amountOutFormatted,
            txUrl:
              slip.payout.destinationTx && route
                ? chainTxUrl(route.chainMark, slip.payout.destinationTx)
                : null,
          }
        })()
      : null,
  }
}

/** A person as the add sheet and the edit sheet send it. */
export const personBody = z.object({
  name: z.string().trim().min(1, "Add their name").max(PAYROLL_LIMITS.name),
  email: z.string().trim().max(PAYROLL_LIMITS.email).optional().default(""),
  role: z.string().trim().max(PAYROLL_LIMITS.role).optional().default(""),
  /** Dollars as typed: "2400" or "2,400.50". */
  amount: z.string().trim(),
})

export function personInput(input: z.infer<typeof personBody>) {
  const amount = parseDollars(input.amount)
  if (amount === null || amount <= 0n) throw badRequest("Enter pay like 2400 or 2,400.50", "amount")
  return { name: input.name, email: input.email || null, role: input.role || null, amount }
}
