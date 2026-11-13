import { requireUser } from "@/lib/server/auth.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"
import { approvalsView } from "@/lib/server/team.ts"

/** Payrolls waiting on this person's vote, and the ones they sent, across the businesses they approve for. */
export const GET = route(async (request) => {
  const user = await requireUser(request)
  return { approvals: await approvalsView(user.id, requestNetwork(request)) }
})
