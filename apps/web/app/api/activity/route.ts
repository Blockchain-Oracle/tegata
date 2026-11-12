import { listPaymentsIn, listPaymentsOut, listSends, rewardsFor } from "@tegata/services"

import { requireUser, workspaceOf } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const LATEST = 20

/** A send has a receipt once it's signed; one that failed or was never approved moved no money. */
const SEND_HAS_RECEIPT = new Set(["signed", "sent", "unknown", "success"])

/**
 * The person's latest money movements: payments into their pay links and invoices, links they paid, their one-off
 * sends and their referral rewards, newest first. Each opens its receipt, which then links to NEAR. The full ledger
 * with filters arrives with Books (S06).
 */
export const GET = route(async (request) => {
  const user = await requireUser(request)
  const workspace = await workspaceOf(user.id)
  const [sends, paidOut, paidIn, rewards] = await Promise.all([
    listSends(db(), user.id),
    listPaymentsOut(db(), user.id),
    workspace ? listPaymentsIn(db(), workspace.id) : Promise.resolve([]),
    rewardsFor(db(), user.id),
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
  ]
  items.sort((a, b) => b.at.localeCompare(a.at))
  return { items: items.slice(0, LATEST) }
})
