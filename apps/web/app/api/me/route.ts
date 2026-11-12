import { usdcBalance } from "@tegata/core/near"
import { getProfile, logoPath } from "@tegata/services"

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
  const { workspace } = profile
  return {
    ...profile,
    // The logo itself is served from its own cached URL, never inside this frequently polled response.
    workspace: workspace && {
      id: workspace.id,
      name: workspace.name,
      timezone: workspace.timezone,
      address: workspace.address,
      taxId: workspace.taxId,
      email: workspace.email,
      logo: logoPath(workspace),
    },
    accounts,
    networks: activeNetworks(),
  }
})
