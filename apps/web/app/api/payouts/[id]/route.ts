import { getPayout } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"
import { payoutView } from "@/lib/server/payouts.ts"

/** Where a payout to another chain is. */
export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const payout = await getPayout(db(), workspace.id, z.uuid().parse((await context.params).id))
  if (!payout) throw notFound("No such payout")
  return { payout: payoutView(payout) }
})
