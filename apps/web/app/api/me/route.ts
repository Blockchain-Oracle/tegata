import { usdcBalance } from "@tegata/core/near"
import { getProfile } from "@tegata/services"

import { requireUser } from "@/lib/server/auth.ts"
import { activeNetworks, db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"

/** The signed-in person, their business, and each account with its live USDC balance. */
export const GET = route(async (request) => {
  const user = await requireUser(request)
  const profile = await getProfile(db(), user.id)
  if (!profile) throw notFound()
  const accounts = await Promise.all(
    profile.accounts.map(async (account) => ({
      ...account,
      balance: account.readyAt ? await usdcBalance(account.network, account.accountId) : 0n,
    })),
  )
  return { ...profile, accounts, networks: activeNetworks() }
})
