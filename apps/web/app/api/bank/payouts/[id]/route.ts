import { getBankPayout } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { bankPayoutView } from "@/lib/server/bank.ts"
import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"

/** Where a withdrawal to a bank is. */
export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const row = await getBankPayout(db(), workspace.id, z.uuid().parse((await context.params).id))
  if (!row) throw notFound("No such withdrawal")
  return { payout: bankPayoutView(row) }
})
