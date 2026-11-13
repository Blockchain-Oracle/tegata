import { enqueue } from "@tegata/jobs"
import { prepareVote, submitVote } from "@tegata/services"
import { z } from "zod"

import { approvalBody } from "@/lib/server/approval.ts"
import { requireUser } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { badRequest, HttpError, route } from "@/lib/server/http.ts"
import { approvalDetailView } from "@/lib/server/team.ts"

type Params = { params: Promise<{ runId: string }> }

/** One payroll for an approver: rows, votes, the treasury and the proposal. */
export const GET = route(async (request, context: Params) => {
  const user = await requireUser(request)
  const view = await approvalDetailView(user.id, (await context.params).runId)
  if (!view) throw new HttpError(404, "not_found", "No such approval")
  return view
})

const vote = z.object({ vote: z.enum(["approve", "reject"]) })

/** The approver's vote, to sign: exactly the proposal on NEAR, checked against the run's rows first. */
export const POST = route(async (request, context: Params) => {
  const user = await requireUser(request)
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  return prepareVote(db(), {
    runId: (await context.params).runId,
    userId: user.id,
    publicKey: user.publicKey,
    vote: vote.parse(await request.json()).vote,
  })
})

const signed = vote.extend({ approval: approvalBody })

/** The approver signed: the worker relays the vote; the one that reaches k pays everyone. */
export const PUT = route(async (request, context: Params) => {
  const user = await requireUser(request)
  const input = signed.parse(await request.json())
  const relayId = await submitVote(db(), {
    runId: (await context.params).runId,
    userId: user.id,
    vote: input.vote,
    approval: input.approval,
  })
  await enqueue(await boss(), "relaySend", { relayId }, relayId)
  return { relayId }
})
