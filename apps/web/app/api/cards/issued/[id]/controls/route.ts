import { toUnits } from "@tegata/core/money"
import { freezeCard, setMonthlyLimit, testPurchase } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { bitnob, issuedCardView } from "@/lib/server/bitnob.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("freeze"), frozen: z.boolean() }),
  z.object({ action: z.literal("limit"), monthlyLimit: z.string().trim().nullable() }),
  z.object({ action: z.literal("test-purchase") }),
])

/** Freeze or unfreeze, set the monthly limit, or (Sandbox) send a test purchase through the issuer. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const cardId = z.uuid().parse((await context.params).id)
  const input = body.parse(await request.json())
  if (input.action === "freeze") {
    const card = await freezeCard(db(), bitnob(), {
      workspaceId: workspace.id,
      cardId,
      frozen: input.frozen,
      by: "owner",
    })
    return { card: card ? issuedCardView(card, 0n) : null }
  }
  if (input.action === "limit") {
    let limit: bigint | null = null
    if (input.monthlyLimit) {
      try {
        limit = toUnits(input.monthlyLimit)
      } catch {
        throw badRequest("Enter a limit like 500 or 500.00", "limit")
      }
    }
    const card = await setMonthlyLimit(db(), bitnob(), {
      workspaceId: workspace.id,
      cardId,
      monthlyLimit: limit,
    })
    return { card: card ? issuedCardView(card, 0n) : null }
  }
  await testPurchase(db(), bitnob(), { workspaceId: workspace.id, cardId })
  return { ok: true }
})
