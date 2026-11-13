import { toUnits } from "@tegata/core/money"
import { usdcBalance } from "@tegata/core/near"
import { serverEnv } from "@tegata/env"
import { accountFor, createPayout } from "@tegata/services"
import { z } from "zod"

import { isStable } from "@/lib/routes"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"
import { routeToken } from "@/lib/server/oneclick.ts"
import { payoutView } from "@/lib/server/payouts.ts"

const body = z.object({
  route: z.string().max(40),
  to: z.string().trim().min(10).max(120),
  amount: z.string().trim(),
})

/** Live: commit to a payout to another chain; returns the gas-free transfer for the business to approve. */
export const POST = route(async (request) => {
  const { user, workspace } = await requireOwner(request)
  if (requestNetwork(request) !== "mainnet")
    throw badRequest("Sending to another chain works in Live")
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  const input = body.parse(await request.json())
  const found = await routeToken(input.route)
  if (!found) throw badRequest("That coin and chain isn't offered right now")
  let amount: bigint
  try {
    amount = toUnits(input.amount)
  } catch {
    throw badRequest("Enter an amount like 25 or 25.50", "bad_amount")
  }
  if (amount <= 0n) throw badRequest("Enter an amount above zero", "bad_amount")
  const account = await accountFor(db(), user.id, "mainnet")
  if (!account?.readyAt) throw badRequest("Your Live account is still opening")
  if ((await usdcBalance("mainnet", account.accountId)) < amount)
    throw badRequest("Not enough dollars in your balance", "insufficient")
  const { payout, relayId, draft } = await createPayout(
    db(),
    {
      workspaceId: workspace.id,
      userId: user.id,
      senderId: account.accountId,
      publicKey: user.publicKey,
      kind: "send",
      amount,
      destinationAsset: found.token.assetId,
      symbol: found.route.symbol,
      chain: found.route.chain,
      recipient: input.to,
      stable: isStable(found.route.symbol),
    },
    serverEnv().ONECLICK_API_KEY,
  )
  return { payout: payoutView(payout), relayId, draft, depositAddress: payout.depositAddress }
})
