import { explorerTx } from "@tegata/core/near"
import { getRelay } from "@tegata/services"

import { requireUser } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"

/** Where a gas-free action is: signed, sent, success, failed, unknown or expired. */
export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(request)
  const { id } = await context.params
  const relay = await getRelay(db(), id, user.id)
  if (!relay) throw notFound()
  return {
    id: relay.id,
    status: relay.status,
    error: relay.error,
    txHash: relay.txHash,
    explorerUrl: relay.txHash ? explorerTx(relay.network, relay.txHash) : null,
  }
})
