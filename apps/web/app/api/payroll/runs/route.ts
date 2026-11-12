import { draftRun } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { PAYROLL_NETWORK } from "@/lib/server/payroll.ts"

/** Draft (or refresh) the run for the next payday from the team as it is now. */
export const POST = route(async (request) => {
  const { user, workspace } = await requireOwner(request)
  const runId = await draftRun(db(), {
    workspaceId: workspace.id,
    ownerId: user.id,
    network: PAYROLL_NETWORK,
  })
  return { runId }
})
