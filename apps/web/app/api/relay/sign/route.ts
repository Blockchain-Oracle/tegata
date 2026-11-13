import { enqueue } from "@tegata/jobs"
import { submitRelaySignature } from "@tegata/services"
import { z } from "zod"

import { requireUser } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** A Privy key's signature over the draft's hash, or a NEAR wallet's own signed delegate. */
const body = z
  .object({
    relayId: z.uuid(),
    signature: z.string().min(1).max(200).optional(),
    signedDelegate: z.string().min(1).max(20_000).optional(),
  })
  .refine(
    (a) => Boolean(a.signature) !== Boolean(a.signedDelegate),
    "Send a signature or a signed delegate",
  )

/** Store the user's approval and hand the action to the worker to send. */
export const POST = route(async (request) => {
  const user = await requireUser(request)
  const input = body.parse(await request.json())
  const relay = await submitRelaySignature(db(), { ...input, userId: user.id })
  await enqueue(await boss(), "relaySend", { relayId: relay.id }, relay.id)
  return { relayId: relay.id, status: relay.status }
})
