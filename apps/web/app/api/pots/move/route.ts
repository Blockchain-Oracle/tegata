import { toUnits } from "@tegata/core/money"
import { usdcBalance } from "@tegata/core/near"
import { accountFor, movePot, potsView } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const body = z.object({
  kind: z.enum(["tax", "savings"]),
  direction: z.enum(["to_spending", "to_pot"]),
  /** Dollars as typed. */
  amount: z.string().trim(),
})

/** Move money between a pot and spending. Only the labels change: the USDC stays on the one NEAR account. */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { user, workspace } = await requireOwner(request)
  const input = body.parse(await request.json())
  let amount: bigint
  try {
    amount = toUnits(input.amount)
  } catch {
    throw badRequest("Enter an amount like 50 or 50.25", "amount")
  }
  const account = await accountFor(db(), user.id, network)
  const balance = account?.readyAt ? await usdcBalance(network, account.accountId) : 0n
  const { spendable } = await potsView(db(), workspace.id, network, balance)
  return movePot(db(), {
    workspaceId: workspace.id,
    network,
    kind: input.kind,
    direction: input.direction,
    amount,
    spendable,
  })
})
