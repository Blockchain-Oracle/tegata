import { explorerTx } from "@tegata/core/near"
import { attemptStatus } from "@tegata/services"
import { z } from "zod"

import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"

/** Where a payment is, for the pay page to follow. The id is unguessable; nothing private is returned. */
export const GET = route(async (_request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params
  const row = await attemptStatus(db(), z.uuid().parse(id))
  if (!row) throw notFound("Payment not found")
  const { payment } = row
  return {
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
