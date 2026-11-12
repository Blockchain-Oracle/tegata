import { enqueue } from "@tegata/jobs"
import { claimWalletTx } from "@tegata/services"
import { z } from "zod"

import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const body = z.object({
  txHash: z.string().trim().min(40).max(60),
  payer: z.string().trim().toLowerCase().min(2),
})

/**
 * A NEAR wallet sent the transfer: remember the hash and let the worker check it on NEAR. Nothing is believed from
 * the browser; the payment is paid only when the USDC event is read from the chain.
 */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params
  const input = body.parse(await request.json())
  const payment = await claimWalletTx(db(), { paymentId: z.uuid().parse(id), ...input })
  if (payment) await enqueue(await boss(), "paymentVerify", { paymentId: payment.id }, payment.id)
  return { status: payment?.status ?? "detected" }
})
