import { getProfile, signInWithWallet } from "@tegata/services"
import { z } from "zod"

import { activeNetworks, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { endSession, requireSessionSecret, startSession } from "@/lib/server/session.ts"

const body = z.object({
  network: z.enum(["testnet", "mainnet"]),
  accountId: z.string().trim().min(2).max(64),
  publicKey: z.string().trim().min(1).max(200),
  signature: z.string().trim().min(1).max(200),
  nonce: z.string().trim().min(1).max(100),
})

/** Check the wallet's signed sign-in message and start a session as that NEAR account. */
export const POST = route(async (request) => {
  const input = body.parse(await request.json())
  requireSessionSecret()
  const user = await signInWithWallet(db(), input)
  const profile = await getProfile(db(), user.id)
  const headers = new Headers({ "content-type": "application/json" })
  for (const value of startSession(user.id)) headers.append("set-cookie", value)
  return new Response(JSON.stringify({ ...profile, networks: activeNetworks() }), { headers })
})

/** Sign out of a wallet session. */
export const DELETE = route(async () => {
  const headers = new Headers({ "content-type": "application/json" })
  for (const value of endSession()) headers.append("set-cookie", value)
  return new Response(JSON.stringify({ ok: true }), { headers })
})
