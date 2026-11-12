import { firstSteps, listPeople } from "@tegata/services"

import { requireUser, workspaceOf } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { PAYROLL_NETWORK } from "@/lib/server/payroll.ts"

/** The first steps this business has taken (Home retires each suggestion once it's done). */
export const GET = route(async (request) => {
  const user = await requireUser(request)
  const workspace = await workspaceOf(user.id)
  if (!workspace) return { invoiceSent: false, linkMade: false, peopleAdded: false }
  const [steps, team] = await Promise.all([
    firstSteps(db(), workspace.id),
    listPeople(db(), workspace.id, PAYROLL_NETWORK),
  ])
  return { ...steps, peopleAdded: team.length > 0 }
})
