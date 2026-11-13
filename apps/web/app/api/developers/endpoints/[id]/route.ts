import { schema } from "@tegata/db"
import { ownEndpoint } from "@tegata/services"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

type Context = { params: Promise<{ id: string }> }

/** Turn an endpoint on or off. */
export const PATCH = route(async (request, context: Context) => {
  const { workspace } = await requireOwner(request)
  const endpoint = await ownEndpoint(db(), workspace.id, z.uuid().parse((await context.params).id))
  const { enabled } = z.object({ enabled: z.boolean() }).parse(await request.json())
  await db()
    .update(schema.webhookEndpoints)
    .set({ enabled })
    .where(eq(schema.webhookEndpoints.id, endpoint.id))
  return { ok: true }
})

export const DELETE = route(async (request, context: Context) => {
  const { workspace } = await requireOwner(request)
  const endpoint = await ownEndpoint(db(), workspace.id, z.uuid().parse((await context.params).id))
  await db().delete(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, endpoint.id))
  return { ok: true }
})
