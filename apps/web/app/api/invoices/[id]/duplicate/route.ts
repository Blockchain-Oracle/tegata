import { duplicateInvoice } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** A new draft with the same customer and items, dated today. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const invoice = await duplicateInvoice(
    db(),
    workspace.id,
    z.uuid().parse((await context.params).id),
  )
  return { invoice }
})
