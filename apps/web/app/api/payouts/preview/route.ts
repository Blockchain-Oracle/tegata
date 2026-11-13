import { toUnits } from "@tegata/core/money"
import { serverEnv } from "@tegata/env"
import { accountFor, previewPayout } from "@tegata/services"

import { requireUser } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"
import { routeToken } from "@/lib/server/oneclick.ts"

/** Live: what arrives on the other chain for an amount, before anything is committed (a dry quote). */
export const GET = route(async (request) => {
  const user = await requireUser(request)
  if (requestNetwork(request) !== "mainnet")
    throw badRequest("Sending to another chain works in Live")
  const params = new URL(request.url).searchParams
  const found = await routeToken(params.get("route") ?? "")
  if (!found) throw badRequest("That coin and chain isn't offered right now")
  const to = (params.get("to") ?? "").trim()
  if (to.length < 10) throw badRequest(`Enter their address on ${found.route.chain}`)
  let amount: bigint
  try {
    amount = toUnits(params.get("amount") ?? "")
  } catch {
    throw badRequest("Enter an amount like 25 or 25.50", "bad_amount")
  }
  const account = await accountFor(db(), user.id, "mainnet")
  if (!account?.readyAt) throw badRequest("Your Live account is still opening")
  return previewPayout(
    {
      senderId: account.accountId,
      amount,
      destinationAsset: found.token.assetId,
      recipient: to,
      stable: found.route.symbol === "USDC" || found.route.symbol === "USDT",
    },
    serverEnv().ONECLICK_API_KEY,
  )
})
