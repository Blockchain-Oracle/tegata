import { enqueue } from "@tegata/jobs"
import { submitTreasuryAction } from "@tegata/services"

import { approvalBody } from "@/lib/server/approval.ts"
import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** The owner's approval of the seal or a transfer into the treasury: stored, then relayed by the worker. */
export const POST = route(async (request) => {
  const { user } = await requireOwner(request)
  const relay = await submitTreasuryAction(db(), user.id, approvalBody.parse(await request.json()))
  if (!relay.purpose.startsWith("treasury-seal:") && !relay.purpose.startsWith("treasury-fund:"))
    throw new Error("Not a treasury action")
  await enqueue(await boss(), "relaySend", { relayId: relay.id }, relay.id)
  return { relayId: relay.id }
})
