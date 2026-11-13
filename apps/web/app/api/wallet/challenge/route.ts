import { createSignInChallenge } from "@tegata/services"
import { z } from "zod"

import { activeNetworks, db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requireSessionSecret } from "@/lib/server/session.ts"

const body = z.object({ network: z.enum(["testnet", "mainnet"]).default("testnet") })

/** A one-time NEP-413 request ("Sign in to Tegata" with a fresh nonce) for a NEAR wallet to sign. */
export const POST = route(async (request) => {
  requireSessionSecret()
  const { network } = body.parse(await request.json().catch(() => ({})))
  if (!activeNetworks().includes(network)) throw badRequest("Live isn't open yet")
  return createSignInChallenge(db(), network)
})
