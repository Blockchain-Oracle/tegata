import { NETWORKS } from "@tegata/config"
import { toUnits } from "@tegata/core/money"
import { accountExists, ftTransfer, isRegistered, usdcBalance } from "@tegata/core/near"
import { accountFor, createRelayDraft } from "@tegata/services"
import { z } from "zod"

import { requireUser } from "@/lib/server/auth.ts"
import { activeNetworks, db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

const MEMO_MAX = 80

const body = z.object({
  network: z.enum(["mainnet", "testnet"]),
  to: z.string().trim().toLowerCase().min(2),
  amount: z.string().trim(),
  note: z.string().trim().max(MEMO_MAX).optional(),
})

/**
 * Start a one-off send of USDC to a NEAR account. The server checks the money can land,
 * builds the transfer, and returns the action for the user to approve.
 */
export const POST = route(async (request) => {
  const user = await requireUser(request)
  const input = body.parse(await request.json())
  if (!activeNetworks().includes(input.network)) throw badRequest("That mode is not switched on")
  if (!user.publicKey) throw badRequest("Your signing key is not ready yet")

  const account = await accountFor(db(), user.id, input.network)
  if (!account?.readyAt) throw badRequest("Your account is still being set up", "not_ready")

  let amount: bigint
  try {
    amount = toUnits(input.amount)
  } catch {
    throw badRequest("Enter an amount like 25 or 25.50", "bad_amount")
  }
  if (amount <= 0n) throw badRequest("Enter an amount above zero", "bad_amount")
  if (input.to === account.accountId) throw badRequest("That is your own account", "bad_recipient")

  const usdc = NETWORKS[input.network].usdc
  if (!(await accountExists(input.network, input.to))) {
    throw badRequest(`${input.to} does not exist`, "bad_recipient")
  }
  if (!(await isRegistered(input.network, usdc, input.to))) {
    throw badRequest(`${input.to} cannot receive dollars yet`, "recipient_not_registered")
  }
  const balance = await usdcBalance(input.network, account.accountId)
  if (balance < amount) throw badRequest("Not enough dollars in your balance", "insufficient")

  const sendId = crypto.randomUUID()
  const { relayId, draft } = await createRelayDraft(db(), {
    userId: user.id,
    network: input.network,
    purpose: `send:${sendId}`,
    senderId: account.accountId,
    receiverId: usdc,
    publicKey: user.publicKey,
    calls: [ftTransfer(input.to, amount, input.note ? `tegata:${input.note}` : "tegata:send")],
  })
  return { relayId, draft, to: input.to, amount }
})
