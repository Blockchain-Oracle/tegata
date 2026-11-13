import { toUnits } from "@tegata/core/money"
import { assertBankNetwork, bankQuote } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { noah } from "@/lib/server/bank.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** What an amount becomes in a bank account in a country, from Noah's live channel. */
export const GET = route(async (request) => {
  await requireOwner(request)
  assertBankNetwork(requestNetwork(request))
  const params = new URL(request.url).searchParams
  let amount: bigint
  try {
    amount = toUnits(params.get("amount") || "0")
  } catch {
    throw badRequest("Enter an amount like 25 or 25.50", "bad_amount")
  }
  return bankQuote(noah(), { country: params.get("country") ?? "NG", amount })
})
