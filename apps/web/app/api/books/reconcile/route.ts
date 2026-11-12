import { explorerTx } from "@tegata/core/near"
import { reconcile } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { PAYROLL_NETWORK } from "@/lib/server/payroll.ts"

/** The books against NEAR: the balance, and every USDC transfer Tegata didn't make or record. */
export const GET = route(async (request) => {
  const { user, workspace } = await requireOwner(request)
  const result = await reconcile(db(), {
    userId: user.id,
    workspaceId: workspace.id,
    network: PAYROLL_NETWORK,
  })
  return {
    accountId: result.accountId,
    balance: result.balance.toString(),
    checked: result.checked,
    outside: result.outside.map((t) => ({
      txHash: t.txHash,
      at: t.at.toISOString(),
      delta: t.delta.toString(),
      other: t.other,
      explorerUrl: explorerTx(PAYROLL_NETWORK, t.txHash),
    })),
  }
})
