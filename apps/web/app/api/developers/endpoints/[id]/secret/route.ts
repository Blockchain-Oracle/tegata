import { ownEndpoint } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** Reveal an endpoint's signing secret to its owner. */
export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const endpoint = await ownEndpoint(db(), workspace.id, z.uuid().parse((await context.params).id))
  return { secret: endpoint.secret }
})
