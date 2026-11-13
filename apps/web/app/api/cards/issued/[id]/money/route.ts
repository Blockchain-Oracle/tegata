import { toUnits } from "@tegata/core/money"
import { enqueue } from "@tegata/jobs"
import { accountFor, draftAddMoney, getIssuedCard, requestMoveBack } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { moveView } from "@/lib/server/bitnob.ts"
import { boss, db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

const body = z.object({ direction: z.enum(["in", "out"]), amount: z.string().trim() })

/**
 * Add money (in): the gas-free transfer to Tegata's card reserve for the owner to approve. Move back (out): recorded
 * here and done by the worker (the issuer lowers the card, the operator returns the USDC).
 */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user, workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const input = body.parse(await request.json())
  let amount: bigint
  try {
    amount = toUnits(input.amount)
  } catch {
    throw badRequest("Enter an amount like 25 or 25.50", "amount")
  }
  const { card } = await getIssuedCard(db(), workspace.id, id)
  if (input.direction === "out") {
    const move = await requestMoveBack(db(), { workspaceId: workspace.id, cardId: id, amount })
    await enqueue(await boss(), "cardFund", { moveId: move.id }, `card-fund:${move.id}`)
    return { move: moveView(move) }
  }
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  const account = await accountFor(db(), user.id, card.network)
  if (!account?.readyAt) throw badRequest("Your account is still opening")
  const drafted = await draftAddMoney(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    publicKey: user.publicKey,
    senderId: account.accountId,
    cardId: id,
    amount,
  })
  return {
    move: moveView(drafted.move),
    relayId: drafted.relayId,
    draft: drafted.draft,
    operator: drafted.operator,
  }
})
