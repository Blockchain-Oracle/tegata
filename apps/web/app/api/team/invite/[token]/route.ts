import { joinTeam, teamInvite } from "@tegata/services"

import { requireUser } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { HttpError, route } from "@/lib/server/http.ts"

/** The invite page's facts (public: who asked and for which business). */
export const GET = route(async (_request, context: { params: Promise<{ token: string }> }) => {
  const invite = await teamInvite(db(), (await context.params).token)
  if (!invite) throw new HttpError(404, "not_found", "This invite has closed")
  return invite
})

/** Join as an approver: signed in with the invited email, with an account open on that network. */
export const POST = route(async (request, context: { params: Promise<{ token: string }> }) => {
  const user = await requireUser(request)
  const member = await joinTeam(db(), (await context.params).token, user)
  return { joined: true, accountId: member.accountId }
})
