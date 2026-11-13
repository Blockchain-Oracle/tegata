import { createApiKey } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { PAYROLL_NETWORK } from "@/lib/server/payroll.ts"

const body = z.object({ name: z.string().trim().max(60).optional().default("") })

/** A new API key. The full key is in this response only; Tegata keeps a hash. */
export const POST = route(async (request) => {
  const { workspace } = await requireOwner(request)
  const { name } = body.parse(await request.json())
  const { key, row } = await createApiKey(db(), {
    workspaceId: workspace.id,
    network: PAYROLL_NETWORK,
    name,
  })
  return { key, id: row.id, prefix: row.prefix }
})
