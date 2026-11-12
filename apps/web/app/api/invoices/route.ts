import { createDraft, listInvoices } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { draftBody, toDraftInput } from "@/lib/server/invoice-input.ts"

/** Every invoice, newest first, with its status worked out now (sent, viewed, partly paid, overdue…). */
export const GET = route(async (request) => {
  const { workspace } = await requireOwner(request)
  return { invoices: await listInvoices(db(), workspace.id) }
})

/** Save a new draft (Sandbox today). */
export const POST = route(async (request) => {
  const { workspace } = await requireOwner(request)
  const input = toDraftInput(draftBody.parse(await request.json()))
  const invoice = await createDraft(db(), { workspaceId: workspace.id, network: "testnet" }, input)
  return { invoice }
})
