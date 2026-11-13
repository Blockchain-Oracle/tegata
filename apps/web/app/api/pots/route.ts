import { usdcBalance } from "@tegata/core/near"
import { accountFor, potsView, setSplitRule } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** The split rule and the pots on this network, with what's spendable of the USDC the account holds on NEAR. */
export const GET = route(async (request) => {
  const network = requestNetwork(request)
  const { user, workspace } = await requireOwner(request)
  const account = await accountFor(db(), user.id, network)
  const balance = account?.readyAt ? await usdcBalance(network, account.accountId) : 0n
  return potsView(db(), workspace.id, network, balance)
})

const rule = z.object({
  on: z.boolean(),
  taxBps: z.number().int(),
  savingsBps: z.number().int(),
})

/** Switch the split on or off and set its shares (basis points). Money already in stays as it is. */
export const PATCH = route(async (request) => {
  const network = requestNetwork(request)
  const { workspace } = await requireOwner(request)
  return { rule: await setSplitRule(db(), workspace.id, network, rule.parse(await request.json())) }
})
