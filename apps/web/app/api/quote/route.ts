import { toUnits } from "@tegata/core/money"
import { z } from "zod"

import { badRequest, route } from "@/lib/server/http.ts"
import { dryQuote, PAYER_ROUTES, QuoteRefused } from "@/lib/server/oneclick.ts"

const MAX_DOLLARS = 1_000_000

const query = z.object({
  amount: z.string().trim(),
  route: z.enum(PAYER_ROUTES.map((r) => r.id) as [string, ...string[]]),
})

/** A live dry quote from NEAR Intents: what a payer sends on `route` so the business receives exactly `amount`. */
export const GET = route(async (request) => {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const input = query.parse(params)
  let units: bigint
  try {
    units = toUnits(input.amount)
  } catch {
    throw badRequest("Enter an amount like 1250", "bad_amount")
  }
  if (units <= 0n || units > toUnits(String(MAX_DOLLARS)))
    throw badRequest("Enter an amount up to $1,000,000", "bad_amount")
  const payer = PAYER_ROUTES.find((r) => r.id === input.route)!
  try {
    return await dryQuote(payer, units)
  } catch (error) {
    if (error instanceof QuoteRefused) throw badRequest(error.message, "no_route")
    throw error
  }
})
