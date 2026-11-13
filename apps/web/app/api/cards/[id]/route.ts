import { unlinkCard } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** Unlink a card (the card itself is untouched). */
export const DELETE = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  await unlinkCard(db(), workspace.id, z.uuid().parse((await context.params).id))
  return { ok: true }
})
