import { removeApprover } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** Take an approver off the list (only before the treasury opens). */
export const DELETE = route(async (request, context: { params: Promise<{ memberId: string }> }) => {
  const { workspace } = await requireOwner(request)
  await removeApprover(db(), workspace.id, (await context.params).memberId)
  return { ok: true }
})
