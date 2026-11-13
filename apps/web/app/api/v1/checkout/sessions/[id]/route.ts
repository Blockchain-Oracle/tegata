import { serverEnv } from "@tegata/env"
import { DeveloperError, getSession, sessionObject } from "@tegata/services"
import { z } from "zod"

import { requireKey } from "@/lib/server/api-v1.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** A checkout session: open, complete (with its payment), or expired. */
export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireKey(request)
  const id = z.uuid().safeParse((await context.params).id)
  const session = id.success ? await getSession(db(), workspace.id, id.data) : null
  if (!session) throw new DeveloperError("not_found", "No such session")
  return sessionObject(db(), session, serverEnv().APP_URL)
})
