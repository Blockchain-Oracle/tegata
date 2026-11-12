import { updateCustomer } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { customerBody } from "@/lib/server/invoice-input.ts"

export const PATCH = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const customer = await updateCustomer(
    db(),
    workspace.id,
    id,
    customerBody.parse(await request.json()),
  )
  return { customer }
})
