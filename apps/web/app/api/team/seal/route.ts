import { draftSeal } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** The owner's seal, to sign: no automatic code updates, then every change needs the approvers. */
export const POST = route(async (request) => {
  const { user, workspace } = await requireOwner(request)
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  return draftSeal(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    network: requestNetwork(request),
    publicKey: user.publicKey,
  })
})
