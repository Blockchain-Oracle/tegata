import { simulateBankDeposit } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { noah } from "@/lib/server/bank.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const body = z.object({ amount: z.string().trim() })

/** Sandbox: a bank transfer into the business's account, through Noah's real flow. */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { workspace } = await requireOwner(request)
  const { amount } = body.parse(await request.json())
  return simulateBankDeposit(db(), noah(), { workspaceId: workspace.id, network, amount })
})
