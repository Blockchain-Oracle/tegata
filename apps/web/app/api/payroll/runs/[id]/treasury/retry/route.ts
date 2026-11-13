import { enqueue } from "@tegata/jobs"
import { prepareTreasuryRetry, submitTreasuryRetry } from "@tegata/services"
import { z } from "zod"

import { approvalBody } from "@/lib/server/approval.ts"
import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

type Params = { params: Promise<{ id: string }> }

/** Try again: finalize the same failed proposal, to sign (re-checked in the browser before signing). */
export const POST = route(async (request, context: Params) => {
  const { user, workspace } = await requireOwner(request)
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  return prepareTreasuryRetry(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    publicKey: user.publicKey,
    runId: z.uuid().parse((await context.params).id),
  })
})

const send = z.object({ approval: approvalBody })

/** The owner signed the retry: the worker relays it and settles the run from what it paid. */
export const PUT = route(async (request, context: Params) => {
  const { user, workspace } = await requireOwner(request)
  const input = send.parse(await request.json())
  const relayId = await submitTreasuryRetry(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    runId: z.uuid().parse((await context.params).id),
    approval: input.approval,
  })
  await enqueue(await boss(), "relaySend", { relayId }, relayId)
  return { relayId }
})
