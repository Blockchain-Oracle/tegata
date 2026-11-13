import { parseDollars } from "@tegata/core/invoices"
import { serverEnv } from "@tegata/env"
import { createSession } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const body = z.object({ amount: z.string().trim() })

/**
 * Add money from another chain (Live): a one-time request to the business's own account, paid on the pay page's
 * "another chain" option (NEAR Intents converts it to USDC on NEAR), then back to Balance.
 */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  if (network !== "mainnet") throw badRequest("Adding money from another chain runs in Live")
  const { user, workspace } = await requireOwner(request)
  const amount = parseDollars(body.parse(await request.json()).amount)
  if (amount === null || amount <= 0n)
    throw badRequest("Enter an amount like 50 or 50.25", "amount")
  const appUrl = serverEnv().APP_URL.replace(/\/$/, "")
  const topUp = await createSession(db(), {
    apiKeyId: null,
    workspaceId: workspace.id,
    ownerId: user.id,
    network,
    amount,
    description: "Add money to your balance",
    successUrl: `${appUrl}/app/balance`,
    metadata: null,
    idempotencyKey: null,
    source: "topup",
  })
  return { url: `/pay/${topUp.token}?rail=chain` }
})
