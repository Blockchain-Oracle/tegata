import { attachReferral, queueReferralJoined, removeReferral } from "@tegata/services"
import { z } from "zod"

import { requireUser } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** Say who referred you (by their handle). It can change until your business is first paid. */
export const PUT = route(async (request) => {
  const network = requestNetwork(request)
  const user = await requireUser(request)
  const { handle } = z
    .object({ handle: z.string().trim().min(2).max(64) })
    .parse(await request.json())
  const referral = await attachReferral(db(), { refereeId: user.id, handle, network: network })
  if (referral) await queueReferralJoined(db(), referral.id)
  return { referral }
})

export const DELETE = route(async (request) => {
  const network = requestNetwork(request)
  const user = await requireUser(request)
  await removeReferral(db(), user.id, network)
  return { removed: true }
})
