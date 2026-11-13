import { queueInvoiceEmail, voidInvoice } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** Cancel an unpaid invoice: its link stops taking payments and any repeat stops. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const invoice = await voidInvoice(db(), workspace.id, z.uuid().parse((await context.params).id))
  // Its customer hears there's nothing to pay.
  await queueInvoiceEmail(db(), invoice.id, "invoice.void")
  return { invoice }
})
