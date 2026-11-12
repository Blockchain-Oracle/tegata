import { parseDollars } from "@tegata/core/invoices"
import { draftAutopilotAction } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

const body = z.object({
  action: z.enum(["pause", "resume", "off", "withdraw", "add"]),
  amount: z.string().trim().optional(),
})

/** One gas-free action to sign: pause, resume, turn off, withdraw or add money. Signed through /api/relay/sign. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user, workspace } = await requireOwner(request)
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  const input = body.parse(await request.json())
  const amount = input.amount ? parseDollars(input.amount) : null
  if (input.amount && amount === null)
    throw badRequest("Enter an amount like 2400 or 2,400.50", "amount")
  return draftAutopilotAction(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    publicKey: user.publicKey,
    id: z.uuid().parse((await context.params).id),
    action: input.action,
    amount: amount ?? undefined,
  })
})
