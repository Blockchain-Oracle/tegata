import { parseDollars } from "@tegata/core/invoices"
import { serverEnv } from "@tegata/env"
import { draftChainRefund, draftRefund, paymentRail } from "@tegata/services"
import { z } from "zod"
import { isStable } from "@/lib/routes"
import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { routeOfAsset } from "@/lib/server/oneclick.ts"
import { payoutView } from "@/lib/server/payouts.ts"

const body = z.object({ amount: z.string().trim() })

/**
 * Draft a refund of a received payment: on NEAR to the account that paid, or, for a payment from another chain, back
 * through NEAR Intents to the payer's own address in the coin they sent. Signed through /api/relay/sign.
 */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user, workspace } = await requireOwner(request)
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  const amount = parseDollars(body.parse(await request.json()).amount)
  if (amount === null) throw badRequest("Enter an amount like 25 or 25.50", "amount")
  const paymentId = z.uuid().parse((await context.params).id)
  const input = {
    workspaceId: workspace.id,
    userId: user.id,
    publicKey: user.publicKey,
    paymentId,
    amount,
  }
  if ((await paymentRail(db(), workspace.id, paymentId)) !== "oneclick")
    return draftRefund(db(), input)
  const { payout, relayId, draft } = await draftChainRefund(
    db(),
    input,
    async (assetId) => {
      const found = await routeOfAsset(assetId)
      return found
        ? {
            symbol: found.route.symbol,
            chain: found.route.chain,
            stable: isStable(found.route.symbol),
          }
        : null
    },
    serverEnv().ONECLICK_API_KEY,
  )
  return { relayId, draft, depositAddress: payout.depositAddress, payout: payoutView(payout) }
})
