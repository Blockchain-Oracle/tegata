import { draftAutopilot } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

/** The two actions to sign together: set the money aside, then create the plan. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user, workspace } = await requireOwner(request)
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  return draftAutopilot(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    publicKey: user.publicKey,
    id: z.uuid().parse((await context.params).id),
  })
})
