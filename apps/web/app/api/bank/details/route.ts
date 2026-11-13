import { ensureBankDetails } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { hopAddress, noah } from "@/lib/server/bank.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** Get bank details for the business (a Noah account; deposits arrive as USDC in its balance). */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { user, workspace } = await requireOwner(request)
  const row = await ensureBankDetails(db(), noah(), {
    workspaceId: workspace.id,
    userId: user.id,
    network,
    hopAddress: hopAddress(),
  })
  return { ok: Boolean(row) }
})
