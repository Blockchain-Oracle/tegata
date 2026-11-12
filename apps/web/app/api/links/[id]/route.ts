import { getLink, setLinkOpen } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"

type Context = { params: Promise<{ id: string }> }

/** One pay link with every payment made to it. */
export const GET = route(async (request, context: Context) => {
  const { workspace } = await requireOwner(request)
  const { id } = await context.params
  const found = await getLink(db(), workspace.id, z.uuid().parse(id))
  if (!found) throw notFound("That pay link doesn't exist")
  return found
})

/** Pause or reopen a link. */
export const PATCH = route(async (request, context: Context) => {
  const { workspace } = await requireOwner(request)
  const { id } = await context.params
  const { open } = z.object({ open: z.boolean() }).parse(await request.json())
  const link = await setLinkOpen(db(), workspace.id, z.uuid().parse(id), open)
  if (!link) throw notFound("That pay link doesn't exist")
  return { link }
})
