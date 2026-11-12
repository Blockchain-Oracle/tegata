import { explorerTx } from "@tegata/core/near"
import { receiptByToken } from "@tegata/services"

import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"

/** A public receipt: who was paid, how much, by which route, when, and the NEAR transaction. */
export const GET = route(async (_request, context: { params: Promise<{ token: string }> }) => {
  const { token } = await context.params
  const row = await receiptByToken(db(), token)
  if (!row) throw notFound("That receipt doesn't exist")
  const { receipt, payment, request, business, logo } = row
  return {
    number: receipt.number,
    business,
    logo,
    title: request.title,
    amount: payment.amount,
    rail: payment.rail,
    payer: payment.payer,
    receiverId: payment.receiverId,
    network: payment.network,
    settledAt: payment.settledAt,
    txHash: payment.txHash,
    explorerUrl: payment.txHash ? explorerTx(payment.network, payment.txHash) : null,
  }
})
