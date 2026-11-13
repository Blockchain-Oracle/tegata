import { getPerson, markInvited, queueInviteEmail } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, notFound, route } from "@/lib/server/http.ts"

/** Email the "choose where your pay lands" invite again (at most once an hour). */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const { member } = await getPerson(db(), workspace.id, id)
  if (!member) throw notFound("No such person")
  if (!member.person.email) throw badRequest("Add their email first")
  await queueInviteEmail(db(), id, { again: new Date().toISOString().slice(0, 13) })
  await markInvited(db(), id)
  return { to: member.person.email }
})
