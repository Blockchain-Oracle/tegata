import { usdcBalance } from "@tegata/core/near"
import { getRun, prepareRun } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

/**
 * Build the batches to sign: one gas-free action per 50 people, each a list of USDC transfers. The balance is checked
 * first, because a batch that can't be covered would fail whole.
 */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user, workspace } = await requireOwner(request)
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  const runId = z.uuid().parse((await context.params).id)
  const { run } = await getRun(db(), workspace.id, runId)
  const balance = await usdcBalance(run.network, run.senderId)
  if (balance < run.total)
    throw badRequest("Not enough dollars in your balance for this run", "insufficient")
  return prepareRun(db(), {
    workspaceId: workspace.id,
    userId: user.id,
    publicKey: user.publicKey,
    runId,
  })
})
