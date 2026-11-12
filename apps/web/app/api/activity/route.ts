import { periodLabel } from "@tegata/core/payroll"
import {
  listPaymentsIn,
  listPaymentsOut,
  listSends,
  payslipsFor,
  rewardsFor,
  runsOut,
} from "@tegata/services"

import { requireUser, workspaceOf } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const LATEST = 20

/** A send has a receipt once it's signed; one that failed or was never approved moved no money. */
const SEND_HAS_RECEIPT = new Set(["signed", "sent", "unknown", "success"])

/**
 * The person's latest money movements: payments into their pay links and invoices, links they paid, their one-off
 * sends, their referral rewards, payroll runs and payslips, newest first. Each opens its receipt, which then links to NEAR. The full ledger
 * with filters arrives with Books (S06).
 */
export const GET = route(async (request) => {
  const user = await requireUser(request)
  const workspace = await workspaceOf(user.id)
  const [sends, paidOut, paidIn, rewards, runs, slips] = await Promise.all([
    listSends(db(), user.id),
    listPaymentsOut(db(), user.id),
    workspace ? listPaymentsIn(db(), workspace.id) : Promise.resolve([]),
    rewardsFor(db(), user.id),
    workspace ? runsOut(db(), workspace.id) : Promise.resolve([]),
    payslipsFor(db(), user.id),
  ])
  const items = [
    ...sends.map((send) => ({
      id: send.id,
      kind: "send" as const,
      network: send.network,
      counterparty: send.to,
      title: null,
      amount: send.amount,
      status: send.status,
      receiptUrl: SEND_HAS_RECEIPT.has(send.status) ? `/r/send/${send.id}` : null,
      at: send.createdAt.toISOString(),
    })),
    ...paidOut.map(({ payment, title, business, receiptToken }) => ({
      id: payment.id,
      kind: "paid" as const,
      network: payment.network,
      counterparty: business,
      title,
      amount: payment.amount,
      status: payment.status,
      receiptUrl: receiptToken ? `/r/${receiptToken}` : null,
      at: (payment.settledAt ?? payment.createdAt).toISOString(),
    })),
    ...paidIn.map(({ payment, title, receiptToken }) => ({
      id: payment.id,
      kind: "received" as const,
      network: payment.network,
      counterparty: payment.payer ?? "A payer",
      title,
      amount: payment.amount,
      status: payment.status,
      receiptUrl: receiptToken ? `/r/${receiptToken}` : null,
      at: (payment.settledAt ?? payment.createdAt).toISOString(),
    })),
    ...rewards.map(({ payout, network }) => ({
      id: payout.id,
      kind: "reward" as const,
      network,
      counterparty: "Tegata",
      title:
        payout.side === "referrer"
          ? "Referral reward: you invited a business"
          : "Referral reward: you joined by invite",
      amount: payout.amount,
      status: "succeeded" as const,
      receiptUrl: `/r/reward/${payout.id}`,
      at: payout.updatedAt.toISOString(),
    })),
    // A payroll run opens its run page (each person's payslip is there); it isn't one receipt.
    ...runs.map((run) => ({
      id: run.id,
      kind: "payroll" as const,
      network: run.network,
      counterparty: run.senderId,
      title: periodLabel({ from: run.periodFrom, to: run.periodTo }),
      amount: run.total,
      status:
        run.status === "paid"
          ? ("succeeded" as const)
          : run.status === "failed"
            ? ("failed" as const)
            : ("sent" as const),
      receiptUrl: `/app/payroll/runs/${run.id}`,
      at: (run.paidAt ?? run.approvedAt ?? run.createdAt).toISOString(),
    })),
    ...slips.map((slip) => ({
      id: slip.id,
      kind: "payslip" as const,
      network: slip.network,
      counterparty: slip.business,
      title: null,
      amount: slip.amount,
      status: "succeeded" as const,
      receiptUrl: `/r/slip/${slip.id}`,
      at: (slip.paidAt ?? new Date()).toISOString(),
    })),
  ]
  items.sort((a, b) => b.at.localeCompare(a.at))
  return { items: items.slice(0, LATEST) }
})
