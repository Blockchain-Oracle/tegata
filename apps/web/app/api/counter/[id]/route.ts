import { closeUnpaidRequest } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** Cancel a counter sale: its QR stops taking payments. A sale already paid stays paid. */
export const DELETE = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const closed = await closeUnpaidRequest(db(), workspace.id, id)
  return { closed: Boolean(closed) }
})
