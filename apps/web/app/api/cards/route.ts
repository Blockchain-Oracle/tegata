import { cardBalances } from "@tegata/core/gnosis"
import { cardTopUps, linkCard, listCards } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"
import { payoutView } from "@/lib/server/payouts.ts"

/** Linked cards with their live balances on the Gnosis chain and their top-ups. */
export const GET = route(async (request) => {
  const network = requestNetwork(request)
  const { workspace } = await requireOwner(request)
  const rows = await listCards(db(), workspace.id, network)
  const cards = await Promise.all(
    rows.map(async (card) => ({
      id: card.id,
      label: card.label,
      account: card.account,
      provider: card.provider,
      balances: await cardBalances(card.account).catch(() => null),
      topUps: (await cardTopUps(db(), workspace.id, card.account)).map(payoutView),
    })),
  )
  return { network, cards }
})

const body = z.object({
  account: z.string().trim().max(60),
  label: z.string().trim().max(40).optional(),
})

/** Link a Gnosis Pay card account by its address. */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { workspace } = await requireOwner(request)
  const input = body.parse(await request.json())
  const card = await linkCard(db(), {
    workspaceId: workspace.id,
    network,
    account: input.account,
    label: input.label ?? "",
  })
  return { id: card?.id }
})
