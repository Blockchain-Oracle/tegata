import { inviteApprover, queueTeamInvite } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"
import { teamPageView } from "@/lib/server/team.ts"

/** The approvers and the team treasury, for the mode on screen. */
export const GET = route(async (request) => {
  const { user, workspace } = await requireOwner(request)
  return teamPageView(workspace.id, user.id, requestNetwork(request))
})

const body = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().max(120) })

/** Invite an approver by email; they join from their own page. */
export const POST = route(async (request) => {
  const { user, workspace } = await requireOwner(request)
  const input = body.parse(await request.json())
  const member = await inviteApprover(db(), {
    workspaceId: workspace.id,
    ownerId: user.id,
    network: requestNetwork(request),
    ...input,
  })
  if (member) await queueTeamInvite(db(), member.id)
  return { id: member?.id, token: member?.token }
})
