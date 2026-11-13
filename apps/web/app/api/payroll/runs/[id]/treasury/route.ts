import { enqueue } from "@tegata/jobs"
import {
  prepareTreasuryRun,
  queueApprovalNeeded,
  reopenTreasuryRun,
  sendRunForApproval,
} from "@tegata/services"
import { z } from "zod"

import { approvalBody } from "@/lib/server/approval.ts"
import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

type Params = { params: Promise<{ id: string }> }

/** The run as one treasury proposal with the owner's yes, to sign (re-checked in the browser before signing). */
export const POST = route(async (request, context: Params) => {
  const { user, workspace } = await requireOwner(request)
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  return prepareTreasuryRun(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    publicKey: user.publicKey,
    runId: z.uuid().parse((await context.params).id),
  })
})

const send = z.object({ proposalId: z.number().int().min(0), approval: approvalBody })

/** The owner signed: the run waits for its approvers (the worker files it on NEAR). */
export const PUT = route(async (request, context: Params) => {
  const { user, workspace } = await requireOwner(request)
  const input = send.parse(await request.json())
  const relayId = await sendRunForApproval(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    runId: z.uuid().parse((await context.params).id),
    proposalId: input.proposalId,
    approval: input.approval,
  })
  await enqueue(await boss(), "relaySend", { relayId }, relayId)
  await queueApprovalNeeded(db(), z.uuid().parse((await context.params).id))
  return { relayId }
})

/** Declined, expired or failed: back to review, to send again as a fresh proposal. */
export const DELETE = route(async (request, context: Params) => {
  const { workspace } = await requireOwner(request)
  await reopenTreasuryRun(db(), workspace.id, z.uuid().parse((await context.params).id))
  return { ok: true }
})
