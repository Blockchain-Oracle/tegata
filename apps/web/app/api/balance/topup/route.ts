import { parseDollars } from "@tegata/core/invoices"
import { serverEnv } from "@tegata/env"
import { createSession } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"
import { cardsOpen } from "@/lib/server/transak.ts"

const body = z.object({
  amount: z.string().trim(),
  via: z.enum(["chain", "card"]).default("chain"),
})

/** Whether adding money with a card is open on this network (Transak's staging keys: Sandbox; production: Live). */
export const GET = route(async (request) => {
  const network = requestNetwork(request)
  await requireOwner(request)
  return cardsOpen(network)
    ? { open: true }
    : {
        open: false,
        reason: network === "mainnet" ? "Opens after Transak's business review" : "Opening soon",
      }
})

/**
 * Add money to your own balance: a one-time request to the business's own account, paid on the pay page's "another
 * chain" option (Live; NEAR Intents converts it) or "card" (Transak sells USDC on NEAR), then back to Balance.
 */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const input = body.parse(await request.clone().json())
  if (input.via === "chain" && network !== "mainnet")
    throw badRequest("Adding money from another chain runs in Live")
  if (input.via === "card" && !cardsOpen(network))
    throw badRequest("Card payments aren't open here yet")
  const { user, workspace } = await requireOwner(request)
  const amount = parseDollars(input.amount)
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
  return { url: `/pay/${topUp.token}?rail=${input.via}` }
})
