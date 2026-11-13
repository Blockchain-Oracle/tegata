import { toUnits } from "@tegata/core/money"
import { accountFor, createBankPayout } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { bankPayoutView, hopAddress, noah } from "@/lib/server/bank.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const body = z.object({
  country: z.string().length(2),
  amount: z.string().trim(),
  /** A saved bank account, or the bank's form filled in for a new one. */
  payoutAccountId: z.uuid().optional(),
  form: z.record(z.string(), z.unknown()).optional(),
  /** The account holder's name Noah found, as the business confirmed it. */
  confirmName: z.string().max(200).optional(),
})

/** Commit to a withdrawal: returns the gas-free transfer for the business to approve. */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { user, workspace } = await requireOwner(request)
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")
  const input = body.parse(await request.json())
  let amount: bigint
  try {
    amount = toUnits(input.amount)
  } catch {
    throw badRequest("Enter an amount like 25 or 25.50", "bad_amount")
  }
  const account = await accountFor(db(), user.id, network)
  if (!account?.readyAt) throw badRequest("Your account is still opening")
  const { payout, relayId, draft, operator } = await createBankPayout(db(), noah(), {
    workspaceId: workspace.id,
    userId: user.id,
    publicKey: user.publicKey,
    senderId: account.accountId,
    network,
    country: input.country,
    amount,
    form: input.form,
    payoutAccountId: input.payoutAccountId,
    hopAddress: hopAddress(),
    confirmName: input.confirmName,
  })
  return {
    payout: bankPayoutView({ payout, label: "" }),
    relayId,
    draft,
    operator,
  }
})
