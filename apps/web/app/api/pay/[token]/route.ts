import { NETWORKS } from "@tegata/config"
import { invoiceNumber } from "@tegata/core/invoices"
import { publicRequest } from "@tegata/services"

import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"

/** What a payer sees: who is asking, for what, how much, and where it lands. Nothing private. */
export const GET = route(async (_request, context: { params: Promise<{ token: string }> }) => {
  const { token } = await context.params
  const found = await publicRequest(db(), token)
  if (!found) throw notFound("This pay link doesn't exist")
  const { request, business, logo, invoice } = found
  return {
    token: request.token,
    business,
    logo,
    title: request.title,
    note: request.note,
    amount: request.amount,
    status: request.status,
    network: request.network,
    receiverId: request.receiverId,
    usdc: NETWORKS[request.network].usdc,
    invoice: invoice
      ? {
          number: invoiceNumber(invoice.number ?? 0),
          allowPartial: invoice.allowPartial,
          dueDate: invoice.dueDate,
          remaining: (request.amount !== null && request.amount > request.paidTotal
            ? request.amount - request.paidTotal
            : 0n
          ).toString(),
        }
      : null,
  }
})
