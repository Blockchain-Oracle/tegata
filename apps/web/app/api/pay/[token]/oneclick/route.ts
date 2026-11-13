import { toUnits } from "@tegata/core/money"
import { serverEnv } from "@tegata/env"
import { enqueue } from "@tegata/jobs"
import { oneClickView, startOneClickPayment } from "@tegata/services"
import { z } from "zod"

import { isStable } from "@/lib/routes"

import { boss, db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { payUri, routeToken } from "@/lib/server/oneclick.ts"

const body = z.object({
  route: z.string().max(40),
  /** The payer's address on the chain they pay from, for a refund. */
  refundTo: z.string().trim().min(10).max(120),
  /** Only for an any-amount link or a part-payment: dollars as typed. */
  amount: z.string().trim().optional(),
  /** Where to send the receipt, if the payer wants one. */
  email: z.email().max(200).optional().or(z.literal("")),
})

/** Live: a signed 1Click deposit address for this payment, from the payer's chosen coin and chain. */
export const POST = route(async (request, context: { params: Promise<{ token: string }> }) => {
  const { token } = await context.params
  const input = body.parse(await request.json())
  const found = await routeToken(input.route)
  if (!found) throw badRequest("That coin and chain isn't offered right now")
  let amount: bigint | undefined
  if (input.amount) {
    try {
      amount = toUnits(input.amount)
    } catch {
      throw badRequest("Enter an amount like 25 or 25.50", "bad_amount")
    }
  }
  const { payment, quote } = await startOneClickPayment(db(), {
    token,
    originAsset: found.token.assetId,
    stable: isStable(found.route.symbol),
    refundTo: input.refundTo,
    amount,
    payerEmail: input.email || undefined,
    apiKey: serverEnv().ONECLICK_API_KEY,
  })
  await enqueue(await boss(), "oneclickPoll", { paymentId: payment.id }, `oneclick:${payment.id}`)
  return {
    paymentId: payment.id,
    ...oneClickView(payment),
    symbol: found.route.symbol,
    chain: found.route.chain,
    // For the payer's own wallet: the coin's contract on its chain (none for a chain's own coin).
    tokenContract: found.token.contractAddress ?? null,
    payUri: payUri(
      found.token,
      quote.depositAddress ?? "",
      quote.amountIn,
      quote.amountInFormatted,
    ),
  }
})
