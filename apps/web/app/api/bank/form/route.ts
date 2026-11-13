import { assertBankNetwork, bankForm } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { noah } from "@/lib/server/bank.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** The bank's own form for a payout channel (bank, account number, purpose), as Noah defines it. */
export const GET = route(async (request) => {
  await requireOwner(request)
  assertBankNetwork(requestNetwork(request))
  const channel = new URL(request.url).searchParams.get("channel")
  if (!channel) throw badRequest("Which channel?")
  return { schema: await bankForm(noah(), channel) }
})
