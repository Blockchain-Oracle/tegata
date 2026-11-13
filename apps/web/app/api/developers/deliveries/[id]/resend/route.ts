import { resendDelivery } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { sendNow } from "@/lib/server/developers.ts"
import { route } from "@/lib/server/http.ts"

/** Send a delivery again from its first try. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const id = await resendDelivery(db(), workspace.id, z.uuid().parse((await context.params).id))
  await sendNow([{ id }])
  return { ok: true }
})
