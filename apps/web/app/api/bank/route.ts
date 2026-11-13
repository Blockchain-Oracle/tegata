import { BANK_COUNTRIES, bankOverview } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { bankOverviewView } from "@/lib/server/bank.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** The Bank page: countries, saved bank accounts, withdrawals, bank details and deposits. */
export const GET = route(async (request) => {
  const network = requestNetwork(request)
  const { workspace } = await requireOwner(request)
  const overview = bankOverviewView(await bankOverview(db(), workspace.id, network))
  return { network, available: network === "testnet", countries: BANK_COUNTRIES, ...overview }
})
