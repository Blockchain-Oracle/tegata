import { parseDollars } from "@tegata/core/invoices"
import { draftRefund } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

const body = z.object({ amount: z.string().trim() })

/** Draft a refund of a received payment back to the account that paid. Signed through /api/relay/sign. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user, workspace } = await requireOwner(request)
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  const amount = parseDollars(body.parse(await request.json()).amount)
  if (amount === null) throw badRequest("Enter an amount like 25 or 25.50", "amount")
  return draftRefund(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    publicKey: user.publicKey,
    paymentId: z.uuid().parse((await context.params).id),
    amount,
  })
})
