import { autopilotPays, draftRun, nextPaydayFor } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { HttpError, route } from "@/lib/server/http.ts"
import { PAYROLL_NETWORK } from "@/lib/server/payroll.ts"

const CONFLICT = 409

/** Draft (or refresh) the run for the next payday from the team as it is now. Not for a payday autopilot pays. */
export const POST = route(async (request) => {
  const { user, workspace } = await requireOwner(request)
  const next = await nextPaydayFor(db(), workspace.id, PAYROLL_NETWORK)
  if (next && (await autopilotPays(db(), workspace.id, PAYROLL_NETWORK, next.payday))) {
    throw new HttpError(
      CONFLICT,
      "autopilot",
      "Autopilot pays this payday, so it can't be run by hand too",
    )
  }
  const runId = await draftRun(db(), {
    workspaceId: workspace.id,
    ownerId: user.id,
    network: PAYROLL_NETWORK,
  })
  return { runId }
})
