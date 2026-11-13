import { z } from "zod"

/** One approval of a drafted action: a Privy key's signature over its hash, or a NEAR wallet's own signed delegate. */
export const approvalBody = z
  .object({
    relayId: z.uuid(),
    signature: z.string().min(1).max(200).optional(),
    signedDelegate: z.string().min(1).max(20_000).optional(),
  })
  .refine(
    (a) => Boolean(a.signature) !== Boolean(a.signedDelegate),
    "Send a signature or a signed delegate",
  )
