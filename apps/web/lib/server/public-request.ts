// A pay link, invoice or checkout session as the public pay page shows it, read straight from the database so the
// first paint already shows who is asking and how much. Shared by the pay page and the embeddable checkout.
import { NETWORKS } from "@tegata/config"
import { invoiceNumber } from "@tegata/core/invoices"
import { publicRequest } from "@tegata/services"

import type { PublicRequest } from "@/lib/client/types"
import { db } from "@/lib/server/context.ts"
import { PAYER_ROUTES } from "@/lib/server/oneclick.ts"

export async function loadPublicRequest(token: string): Promise<PublicRequest | null> {
  const found = await publicRequest(db(), token)
  if (!found) return null
  const { request, business, logo, invoice, receiptToken } = found
  return {
    token: request.token,
    business,
    logo,
    title: request.title,
    note: request.note,
    amount: request.amount === null ? null : request.amount.toString(),
    status: request.status,
    network: request.network,
    receiverId: request.receiverId,
    usdc: NETWORKS[request.network].usdc,
    successUrl: request.successUrl,
    receiptToken,
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
}

/** The coins and chains a payer can pick, as the pay page needs them. */
export const payRoutes = () =>
  PAYER_ROUTES.map(({ id, symbol, chain, coin, chainMark }) => ({
    id,
    symbol,
    chain,
    coin,
    chainMark,
  }))
