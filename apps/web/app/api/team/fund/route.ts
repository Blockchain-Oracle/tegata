import { toUnits } from "@tegata/core/money"
import { draftFund } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const body = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter dollars like 120 or 120.50"),
})

/** Move dollars from the balance into the team treasury: one gas-free transfer, to sign. */
export const POST = route(async (request) => {
  const { user, workspace } = await requireOwner(request)
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  const { amount } = body.parse(await request.json())
  return draftFund(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    network: requestNetwork(request),
    publicKey: user.publicKey,
    amount: toUnits(amount),
  })
})
