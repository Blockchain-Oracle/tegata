import { explorerTx } from "@tegata/core/near"
import { listSends } from "@tegata/services"

import { requireUser } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/**
 * The person's latest money movements. Today that is their one-off sends; payments in arrive with pay links (S01)
 * and the full ledger with Books (S06).
 */
export const GET = route(async (request) => {
  const user = await requireUser(request)
  const sends = await listSends(db(), user.id)
  return {
    items: sends.map((send) => ({
      id: send.id,
      kind: "send" as const,
      network: send.network,
      counterparty: send.to,
      amount: send.amount,
      status: send.status,
      explorerUrl: send.txHash ? explorerTx(send.network, send.txHash) : null,
      at: send.createdAt.toISOString(),
    })),
  }
})
