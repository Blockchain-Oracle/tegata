import { emailConfigured } from "@tegata/env"
import { enqueue } from "@tegata/jobs"
import { getInvoice, reminderState } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { badRequest, notFound, route } from "@/lib/server/http.ts"

/**
 * "Remind now": today's reminder to the customer at once, worded by how late the invoice is. At most once a day per
 * invoice (the outbox keys it by the business's local date), and it goes even with the scheduled ones switched off.
 */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const found = await getInvoice(db(), workspace.id, id)
  if (!found) throw notFound("That invoice doesn't exist")
  const state = reminderState(found, emailConfigured())
  if (!state) throw badRequest("Only a sent, unpaid invoice can be reminded")
  if (!state.canSend) throw badRequest(state.why ?? "This reminder can't go out")
  if (state.remindedToday) throw badRequest("A reminder already went today")
  await enqueue(
    await boss(),
    "invoiceEmail",
    { invoiceId: id, kind: "reminder", offset: state.offsetToday, manualDay: state.today },
    `${id}:remind:now:${state.today}`,
  )
  return { to: state.email }
})
