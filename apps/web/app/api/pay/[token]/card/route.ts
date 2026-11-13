import { toUnits } from "@tegata/core/money"
import { serverEnv } from "@tegata/env"
import { enqueue } from "@tegata/jobs"
import { cardQuote, publicRequest, startCardPayment } from "@tegata/services"
import { z } from "zod"

import { boss, db } from "@/lib/server/context.ts"
import { badRequest, notFound, route } from "@/lib/server/http.ts"
import { cardsOpen, transak } from "@/lib/server/transak.ts"

type Params = { params: Promise<{ token: string }> }

const amountOf = (value: string | null | undefined) => {
  if (!value) return undefined
  try {
    return toUnits(value)
  } catch {
    throw badRequest("Enter an amount like 25 or 25.50", "amount")
  }
}

/** What the payer's card pays (fee included) for the amount the business gets, before anything opens. */
export const GET = route(async (request, context: Params) => {
  const { token } = await context.params
  const found = await publicRequest(db(), token)
  if (!found) throw notFound("This pay link doesn't exist")
  const network = found.request.network
  const client = transak()
  if (!client || !cardsOpen(network))
    return {
      open: false,
      reason:
        network === "mainnet"
          ? "Card payments in Live open after Transak's review"
          : "Card payments aren't set up yet",
    }
  const asked = amountOf(new URL(request.url).searchParams.get("amount"))
  const amount = found.request.amount ?? asked
  if (!amount) return { open: true, quote: null }
  return { open: true, quote: await cardQuote(client, amount) }
})

const body = z.object({
  amount: z.string().trim().optional(),
  email: z.email().optional().or(z.literal("")),
})

/** Start paying by card: the attempt, and Transak's single-use checkout, locked to this payment. */
export const POST = route(async (request, context: Params) => {
  const { token } = await context.params
  const client = transak()
  if (!client) throw badRequest("Card payments aren't set up yet")
  const input = body.parse(await request.json())
  const { payment, widgetUrl } = await startCardPayment(db(), client, {
    token,
    amount: amountOf(input.amount),
    payerEmail: input.email || undefined,
    appUrl: serverEnv().APP_URL,
  })
  await enqueue(await boss(), "cardPayPoll", { paymentId: payment.id }, `card-pay:${payment.id}`)
  return { paymentId: payment.id, widgetUrl }
})
