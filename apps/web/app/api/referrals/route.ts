import { REFERRALS } from "@tegata/config"
import { listReferrals, referredBy } from "@tegata/services"

import { requireUser } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** The Refer page: your link, the rule on this network, the businesses you invited, and who invited you. */
export const GET = route(async (request) => {
  const network = requestNetwork(request)
  const user = await requireUser(request)
  const rules = REFERRALS[network]
  const [invited, by] = await Promise.all([
    listReferrals(db(), user.id, network),
    referredBy(db(), user.id, network),
  ])
  return {
    handle: user.handle,
    network: network,
    rules: {
      threshold: rules.threshold,
      reward: rules.reward,
      windowDays: rules.windowDays,
      holdMinutes: Math.round(rules.holdMs / 60_000),
      yearlyCap: rules.yearlyCap,
    },
    invited,
    referredBy: by,
  }
})
