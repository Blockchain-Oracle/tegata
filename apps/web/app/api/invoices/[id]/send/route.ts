import { emailConfigured } from "@tegata/env"
import { enqueue } from "@tegata/jobs"
import { reminderTimes, sendInvoice } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/**
 * Send a draft: it gets its number and its public link in one transaction. When email is set up, the customer is
 * emailed now and reminders are queued around the due date; otherwise the link is ready to copy and share.
 */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user, workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const { invoice, token, timezone } = await sendInvoice(
    db(),
    { workspaceId: workspace.id, ownerId: user.id },
    id,
  )
  const emailed = emailConfigured() && Boolean(invoice.billTo?.email)
  if (emailed) {
    const queue = await boss()
    await enqueue(
      queue,
      "invoiceEmail",
      { invoiceId: invoice.id, kind: "invoice" },
      `${invoice.id}:invoice`,
    )
    if (invoice.reminders) {
      for (const { offset, at } of reminderTimes(invoice.dueDate, timezone)) {
        await enqueue(
          queue,
          "invoiceEmail",
          { invoiceId: invoice.id, kind: "reminder", offset },
          `${invoice.id}:remind:${offset}`,
          { startAfter: at },
        )
      }
    }
  }
  return { invoice, token, emailed }
})
