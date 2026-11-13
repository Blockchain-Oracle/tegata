import { revokeApiKey } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** Revoke a key: requests with it are refused from now on. */
export const DELETE = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  await revokeApiKey(db(), workspace.id, z.uuid().parse((await context.params).id))
  return { ok: true }
})
