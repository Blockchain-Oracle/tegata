import { explorerTx } from "@tegata/core/near"
import { attemptStatus, oneClickView } from "@tegata/services"
import { z } from "zod"

import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"
import { payUri, routeOfAsset } from "@/lib/server/oneclick.ts"

/** Where a payment is, for the pay page to follow. The id is unguessable; nothing private is returned. */
export const GET = route(async (_request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params
  const row = await attemptStatus(db(), z.uuid().parse(id))
  if (!row) throw notFound("Payment not found")
  const { payment } = row
  // A Live payment from another chain: where to send, how much, and what 1Click says about it.
  let oneclick = null
  if (payment.rail === "oneclick") {
    const view = oneClickView(payment)
    const found = payment.assetIn ? await routeOfAsset(payment.assetIn) : null
    oneclick = {
      ...view,
      symbol: found?.route.symbol ?? null,
      chain: found?.route.chain ?? null,
      coin: found?.route.coin ?? null,
      chainMark: found?.route.chainMark ?? null,
      payUri:
        found && view.depositAddress && view.amountIn && view.amountInFormatted
          ? payUri(found.token, view.depositAddress, view.amountIn, view.amountInFormatted)
          : null,
    }
  }
  return {
    oneclick,
    id: payment.id,
    status: payment.status,
    rail: payment.rail,
    relayStatus: row.relayStatus,
    amount: payment.amount,
    error: payment.error,
    receiptToken: row.receiptToken,
    explorerUrl: payment.txHash ? explorerTx(payment.network, payment.txHash) : null,
  }
})
