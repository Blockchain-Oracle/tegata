import { toUnits } from "@tegata/core/money"
import { draftTegataPayment, startAttempt } from "@tegata/services"
import { z } from "zod"

import { requireUser } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

const body = z.object({
  rail: z.enum(["tegata", "near_wallet"]),
  /** Only for an any-amount link: dollars as typed. */
  amount: z.string().trim().optional(),
  /** The NEAR account a wallet payer is paying from. */
  payer: z.string().trim().toLowerCase().optional(),
  /** Where to send the receipt, if the payer wants one. */
  email: z.email().max(200).optional().or(z.literal("")),
})

/**
 * Start paying a link. The Tegata rail needs the payer signed in and returns the transfer for them to sign; the
 * wallet rail returns exactly what the wallet must send (receiver, amount, memo).
 */
export const POST = route(async (request, context: { params: Promise<{ token: string }> }) => {
  const { token } = await context.params
  const input = body.parse(await request.json())
  let amount: bigint | undefined
  if (input.amount) {
    try {
      amount = toUnits(input.amount)
    } catch {
      throw badRequest("Enter an amount like 25 or 25.50", "bad_amount")
    }
  }

  if (input.rail === "tegata") {
    const user = await requireUser(request)
    if (!user.publicKey) throw badRequest("Your signing key isn't ready yet")
    const attempt = await startAttempt(db(), {
      token,
      rail: "tegata",
      amount,
      payerEmail: user.email ?? undefined,
    })
    const { relayId, draft } = await draftTegataPayment(db(), {
      paymentId: attempt.id,
      userId: user.id,
      publicKey: user.publicKey,
      network: attempt.network,
    })
    return {
      paymentId: attempt.id,
      relayId,
      draft,
      amount: attempt.amount,
      receiverId: attempt.receiverId,
    }
  }

  const attempt = await startAttempt(db(), {
    token,
    rail: "near_wallet",
    amount,
    payer: input.payer,
    payerEmail: input.email || undefined,
  })
  return {
    paymentId: attempt.id,
    network: attempt.network,
    receiverId: attempt.receiverId,
    amount: attempt.amount,
    memo: attempt.memo,
  }
})
