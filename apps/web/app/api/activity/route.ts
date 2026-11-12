import { explorerTx } from "@tegata/core/near"
import { listPaymentsIn, listPaymentsOut, listSends } from "@tegata/services"

import { requireUser, workspaceOf } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const LATEST = 20

/**
 * The person's latest money movements: payments into their pay links, links they paid, and their one-off sends,
 * newest first. The full ledger with filters arrives with Books (S06).
 */
export const GET = route(async (request) => {
  const user = await requireUser(request)
  const workspace = await workspaceOf(user.id)
  const [sends, paidOut, paidIn] = await Promise.all([
    listSends(db(), user.id),
    listPaymentsOut(db(), user.id),
    workspace ? listPaymentsIn(db(), workspace.id) : Promise.resolve([]),
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
      receiptToken: null,
      explorerUrl: send.txHash ? explorerTx(send.network, send.txHash) : null,
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
      receiptToken,
      explorerUrl: payment.txHash ? explorerTx(payment.network, payment.txHash) : null,
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
      receiptToken,
      explorerUrl: payment.txHash ? explorerTx(payment.network, payment.txHash) : null,
      at: (payment.settledAt ?? payment.createdAt).toISOString(),
    })),
  ]
  items.sort((a, b) => b.at.localeCompare(a.at))
  return { items: items.slice(0, LATEST) }
})
