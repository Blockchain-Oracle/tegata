import { REFERRALS } from "@tegata/config"
import { listReferrals, referredBy } from "@tegata/services"

import { requireUser } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const NETWORK = "testnet" as const

/** The Refer page: your link, the rule on this network, the businesses you invited, and who invited you. */
export const GET = route(async (request) => {
  const user = await requireUser(request)
  const rules = REFERRALS[NETWORK]
  const [invited, by] = await Promise.all([
    listReferrals(db(), user.id, NETWORK),
    referredBy(db(), user.id, NETWORK),
  ])
  return {
    handle: user.handle,
    network: NETWORK,
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
