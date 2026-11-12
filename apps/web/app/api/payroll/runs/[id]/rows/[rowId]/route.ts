import { setRowIncluded } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const body = z.object({ included: z.boolean() })

/** Leave someone out of this run, or put them back, while it is being reviewed. */
export const PATCH = route(
  async (request, context: { params: Promise<{ id: string; rowId: string }> }) => {
    const { workspace } = await requireOwner(request)
    const { id, rowId } = await context.params
    await setRowIncluded(db(), {
      workspaceId: workspace.id,
      runId: z.uuid().parse(id),
      rowId: z.uuid().parse(rowId),
      included: body.parse(await request.json()).included,
    })
    return { ok: true }
  },
)
