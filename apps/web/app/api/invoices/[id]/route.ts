import { emailConfigured } from "@tegata/env"
import { deleteDraft, getInvoice, reminderState, updateDraft } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"
import { draftBody, toDraftInput } from "@/lib/server/invoice-input.ts"

type Context = { params: Promise<{ id: string }> }
const idOf = async (context: Context) => z.uuid().parse((await context.params).id)

/** One invoice: the document, its lines, payments, timeline, status and where its reminders stand. */
export const GET = route(async (request, context: Context) => {
  const { workspace } = await requireOwner(request)
  const found = await getInvoice(db(), workspace.id, await idOf(context))
  if (!found) throw notFound("That invoice doesn't exist")
  return { ...found, reminders: reminderState(found, emailConfigured()) }
})

/** Save changes to a draft. */
export const PATCH = route(async (request, context: Context) => {
  const { workspace } = await requireOwner(request)
  const input = toDraftInput(draftBody.parse(await request.json()))
  const invoice = await updateDraft(db(), workspace.id, await idOf(context), input)
  return { invoice }
})

/** Delete a draft (a sent invoice is voided instead). */
export const DELETE = route(async (request, context: Context) => {
  const { workspace } = await requireOwner(request)
  await deleteDraft(db(), workspace.id, await idOf(context))
  return { deleted: true }
})
