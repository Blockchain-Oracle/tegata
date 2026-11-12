import { explorerTx } from "@tegata/core/near"
import { testDollarsFor } from "@tegata/services"
import { z } from "zod"

import { requireUser } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"

/** Where today's test dollars are: queued, sent (with the NEAR transaction) or failed (with why). */
export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(request)
  const { id } = await context.params
  const grant = await testDollarsFor(db(), user.id, z.uuid().parse(id))
  if (!grant) throw notFound("Not found")
  return {
    id: grant.id,
    status: grant.status,
    amount: grant.amount,
    error: grant.error,
    explorerUrl: grant.txHash ? explorerTx("testnet", grant.txHash) : null,
  }
})
