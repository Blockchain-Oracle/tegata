import { toUnits } from "@tegata/core/money"
import { createLink, LINK_LIMITS, listLinks } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const body = z.object({
  title: z.string().trim().min(1, "Give the link a name").max(LINK_LIMITS.title),
  note: z.string().trim().max(LINK_LIMITS.note).optional(),
  /** Dollars as typed ("25" or "25.50"); absent for an any-amount link. */
  amount: z.string().trim().optional(),
})

/** The business's pay links, newest first. */
export const GET = route(async (request) => {
  const { workspace } = await requireOwner(request)
  return { links: await listLinks(db(), workspace.id) }
})

/** Create a pay link (Sandbox today; Live joins when the operator is funded). */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { user, workspace } = await requireOwner(request)
  const input = body.parse(await request.json())
  let amount: bigint | undefined
  if (input.amount) {
    try {
      amount = toUnits(input.amount)
    } catch {
      throw badRequest("Enter an amount like 25 or 25.50", "bad_amount")
    }
  }
  const link = await createLink(db(), {
    workspaceId: workspace.id,
    ownerId: user.id,
    network,
    title: input.title,
    note: input.note,
    amount,
  })
  return { link }
})
