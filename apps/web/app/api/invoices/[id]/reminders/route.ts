import { emailConfigured } from "@tegata/env"
import { enqueue } from "@tegata/jobs"
import { getInvoice, reminderTimes, setInvoiceReminders } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"

const body = z.object({ on: z.boolean() })

/**
 * Switch a sent invoice's scheduled reminders on or off. Off: the worker reads the flag before each one and stops.
 * On: the steps still ahead are queued (a step already queued at send still goes once: the outbox keys each step).
 */
export const PATCH = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const { on } = body.parse(await request.json())
  await setInvoiceReminders(db(), workspace.id, id, on)
  const found = await getInvoice(db(), workspace.id, id)
  if (!found) throw notFound("That invoice doesn't exist")
  if (on && emailConfigured() && found.invoice.billTo?.email) {
    const queue = await boss()
    for (const { offset, at } of reminderTimes(found.invoice.dueDate, found.timezone))
      await enqueue(
        queue,
        "invoiceEmail",
        { invoiceId: id, kind: "reminder", offset },
        `${id}:remind:${offset}`,
        { startAfter: at },
      )
  }
  return { on }
})
