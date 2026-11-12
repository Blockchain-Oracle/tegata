import { firstSteps } from "@tegata/services"

import { requireUser, workspaceOf } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** The first steps this business has taken (Home retires each suggestion once it's done). */
export const GET = route(async (request) => {
  const user = await requireUser(request)
  const workspace = await workspaceOf(user.id)
  if (!workspace) return { invoiceSent: false, linkMade: false }
  return firstSteps(db(), workspace.id)
})
