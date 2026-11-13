import { getProfile, noteSeen, syncPrivyUser } from "@tegata/services"

import { privy, privyUserId, publicKeyFromNearAddress } from "@/lib/server/auth.ts"
import { activeNetworks, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { seenOf } from "@/lib/server/seen.ts"

/**
 * Called once after sign-in. The email and the signing key are read from Privy on the
 * server, so the browser cannot claim a key that is not its own.
 */
export const POST = route(async (request) => {
  const privyId = await privyUserId(request)
  const account = await privy().users()._get(privyId)

  let email: string | null = null
  let publicKey: string | null = null
  for (const linked of account.linked_accounts) {
    if (linked.type === "email") email = linked.address
    if (linked.type === "wallet" && "chain_type" in linked && linked.chain_type === "near") {
      publicKey = publicKeyFromNearAddress(linked.address)
    }
  }

  const user = await syncPrivyUser(db(), { privyId, email, publicKey })
  const { seen, setCookie } = seenOf(request)
  await noteSeen(db(), user.id, seen)
  const profile = await getProfile(db(), user.id)
  const headers = new Headers({ "content-type": "application/json" })
  if (setCookie) headers.append("set-cookie", setCookie)
  return new Response(JSON.stringify({ ...profile, networks: activeNetworks() }), { headers })
})
