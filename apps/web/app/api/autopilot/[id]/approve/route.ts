import { enqueue } from "@tegata/jobs"
import { approveAutopilot } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const body = z.object({
  signatures: z.array(z.object({ relayId: z.uuid(), signature: z.string().min(1) })).length(2),
})

/** Store both signatures, then queue the relays in order: the deposit, then the plan. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user, workspace } = await requireOwner(request)
  const order = await approveAutopilot(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    id: z.uuid().parse((await context.params).id),
    signatures: body.parse(await request.json()).signatures,
  })
  const queue = await boss()
  for (const relayId of order) await enqueue(queue, "relaySend", { relayId }, relayId)
  return { ok: true }
})
