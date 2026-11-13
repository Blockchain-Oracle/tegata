import { toUnits } from "@tegata/core/money"
import { accountFor, draftNewCard, listIssuedCards } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { issuedCardView, issuerReady, purchaseView } from "@/lib/server/bitnob.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** The business's cards with this month's spend, and the latest purchases across them. */
export const GET = route(async (request) => {
  const network = requestNetwork(request)
  const { workspace } = await requireOwner(request)
  const listed = await listIssuedCards(db(), workspace.id, network)
  const { cards, purchases } = Array.isArray(listed) ? { cards: [], purchases: [] } : listed
  return {
    network,
    issuer: issuerReady() ? "bitnob" : null,
    cards: cards.map(({ card, spentThisMonth }) => issuedCardView(card, spentThisMonth)),
    purchases: purchases.map(purchaseView),
  }
})

const dollars = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      try {
        return toUnits(value)
      } catch {
        ctx.addIssue({ code: "custom", message: `Enter ${label} like 25 or 25.50` })
        return z.NEVER
      }
    })

const body = z.object({
  personId: z.uuid().nullable(),
  nickname: z.string().trim().max(24),
  startWith: dollars("an amount"),
  monthlyLimit: dollars("a limit").nullable(),
})

/** Make a card: saved as "making", with the gas-free transfer of its first fill for the owner to approve. */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { user, workspace } = await requireOwner(request)
  if (!issuerReady()) throw badRequest("Cards aren't set up on this server yet")
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  const input = body.parse(await request.json())
  const account = await accountFor(db(), user.id, network)
  if (!account?.readyAt) throw badRequest("Your account is still opening")
  const made = await draftNewCard(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    publicKey: user.publicKey,
    senderId: account.accountId,
    network,
    personId: input.personId,
    nickname: input.nickname,
    monthlyLimit: input.monthlyLimit,
    startWith: input.startWith,
  })
  return {
    card: issuedCardView(made.card, 0n),
    moveId: made.move.id,
    relayId: made.relayId,
    draft: made.draft,
    operator: made.operator,
  }
})
