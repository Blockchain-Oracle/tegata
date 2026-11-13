import { createApiKey } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const body = z.object({ name: z.string().trim().max(60).optional().default("") })

/** A new API key. The full key is in this response only; Tegata keeps a hash. */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { workspace } = await requireOwner(request)
  const { name } = body.parse(await request.json())
  const { key, row } = await createApiKey(db(), {
    workspaceId: workspace.id,
    network: network,
    name,
  })
  return { key, id: row.id, prefix: row.prefix }
})
