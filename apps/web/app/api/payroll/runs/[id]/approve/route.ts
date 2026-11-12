import { enqueue } from "@tegata/jobs"
import { approveRun } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const body = z.object({
  signatures: z.array(z.object({ relayId: z.uuid(), signature: z.string().min(1) })).min(1),
})

/** Store the owner's signature on every batch, then hand each to the worker. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user, workspace } = await requireOwner(request)
  const runId = z.uuid().parse((await context.params).id)
  const relayIds = await approveRun(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    runId,
    signatures: body.parse(await request.json()).signatures,
  })
  const queue = await boss()
  for (const relayId of relayIds) await enqueue(queue, "relaySend", { relayId }, relayId)
  return { runId, batches: relayIds.length }
})
