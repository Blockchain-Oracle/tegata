import { enqueue } from "@tegata/jobs"
import { attachReferral, onboard, ReferralError } from "@tegata/services"
import { z } from "zod"

import { requireUser } from "@/lib/server/auth.ts"
import { activeNetworks, boss, db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

const BUSINESS_NAME_MAX = 80

const body = z.object({
  handle: z.string().trim().toLowerCase(),
  businessName: z.string().trim().min(1, "Give the business a name").max(BUSINESS_NAME_MAX),
  timezone: z.string().trim().min(1),
  /** The handle from a join link, if the person came through one. */
  referrer: z.string().trim().toLowerCase().max(64).optional(),
})

/** Name the business, claim `name.tegata.near`, and start creating the accounts. */
export const POST = route(async (request) => {
  const user = await requireUser(request)
  const input = body.parse(await request.json())
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input.timezone })
  } catch {
    throw badRequest("Unknown time zone")
  }
  const { referrer, ...business } = input
  const result = await onboard(db(), { userId: user.id, ...business, networks: activeNetworks() })
  const queue = await boss()
  for (const account of result.accounts) {
    await enqueue(queue, "accountSetup", { accountRowId: account.id }, account.id)
  }
  // A join link that doesn't check out (their own, a typo) never blocks opening the account; it is reported.
  let referral: { ok: true } | { ok: false; problem: string } | null = null
  if (referrer) {
    try {
      await attachReferral(db(), { refereeId: user.id, handle: referrer, network: "testnet" })
      referral = { ok: true }
    } catch (error) {
      if (!(error instanceof ReferralError)) throw error
      referral = { ok: false, problem: error.message }
    }
  }
  return { ...result, referral }
})
