import { enqueue } from "@tegata/jobs"
import { openTreasury } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const body = z.object({ threshold: z.number().int().min(2).max(10) })

/** Every approver has joined: create the team treasury on NEAR (the worker does it, the operator pays). */
export const POST = route(async (request) => {
  const { user, workspace } = await requireOwner(request)
  const { threshold } = body.parse(await request.json())
  const treasury = await openTreasury(db(), {
    workspaceId: workspace.id,
    ownerId: user.id,
    network: requestNetwork(request),
    threshold,
  })
  await enqueue(
    await boss(),
    "treasuryOpen",
    { treasuryId: treasury.id },
    `treasury-open:${treasury.id}`,
  )
  return { treasuryId: treasury.id, accountId: treasury.accountId }
})
