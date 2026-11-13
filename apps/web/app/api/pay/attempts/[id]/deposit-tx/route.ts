import { submitDeposit } from "@tegata/core/oneclick"
import { serverEnv } from "@tegata/env"
import { attemptStatus } from "@tegata/services"
import { z } from "zod"

import { db } from "@/lib/server/context.ts"
import { badRequest, notFound, route } from "@/lib/server/http.ts"

const body = z.object({ txHash: z.string().trim().min(10).max(120) })

/**
 * The payer's wallet sent the deposit: tell NEAR Intents the transaction, so it picks it up sooner. Only a hint:
 * NEAR Intents checks the chain itself, and "paid" still comes from the USDC arriving on NEAR.
 */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params
  const { txHash } = body.parse(await request.json())
  const row = await attemptStatus(db(), z.uuid().parse(id))
  if (!row) throw notFound("Payment not found")
  const { payment } = row
  if (payment.rail !== "oneclick" || !payment.depositAddress)
    throw badRequest("This payment isn't paid from another chain")
  await submitDeposit(
    { txHash, depositAddress: payment.depositAddress },
    serverEnv().ONECLICK_API_KEY,
  )
  return { ok: true }
})
