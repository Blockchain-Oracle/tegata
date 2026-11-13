import { enqueue } from "@tegata/jobs"
import { getIssuedCard, renameCard } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { issuedCardView, moveView, purchaseView } from "@/lib/server/bitnob.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

type Params = { params: Promise<{ id: string }> }

/** One card: its purchases and money moves. */
export const GET = route(async (request, context: Params) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const { card, purchases, moves } = await getIssuedCard(db(), workspace.id, id)
  return {
    card: issuedCardView(card, 0n),
    purchases: purchases.map(purchaseView),
    moves: moves.map(moveView),
  }
})

/** Rename it. */
export const PATCH = route(async (request, context: Params) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const { nickname } = z.object({ nickname: z.string().max(24) }).parse(await request.json())
  const card = await renameCard(db(), { workspaceId: workspace.id, cardId: id, nickname })
  return { ok: Boolean(card) }
})

/** Remove it for good: the worker moves what's left back to the balance, then the issuer ends it. */
export const DELETE = route(async (request, context: Params) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const { card } = await getIssuedCard(db(), workspace.id, id)
  await enqueue(
    await boss(),
    "cardRemove",
    { cardId: card.id, network: card.network },
    `card-remove:${card.id}`,
  )
  return { ok: true }
})
