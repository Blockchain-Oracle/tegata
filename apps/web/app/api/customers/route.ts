import { createCustomer, listCustomers } from "@tegata/services"
import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { customerBody } from "@/lib/server/invoice-input.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** The business's customers, with what each was billed, paid and still owes. */
export const GET = route(async (request) => {
  const { workspace } = await requireOwner(request)
  return { customers: await listCustomers(db(), workspace.id, requestNetwork(request)) }
})

export const POST = route(async (request) => {
  const { workspace } = await requireOwner(request)
  const customer = await createCustomer(
    db(),
    workspace.id,
    customerBody.parse(await request.json()),
  )
  return { customer }
})
