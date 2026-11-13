// Money out to another chain through NEAR Intents 1Click (plan 6.8 AB; context/09-realworld-money/live-1click-notes.md §2).
// The business sends exactly `amount` of USDC (EXACT_INPUT) to a fresh 1Click deposit address on NEAR. Tegata's
// operator registers that address on USDC in its own transaction (a deposit above 1 yocto never rides inside a user's
// relayed action), the business's gas-free action sends the USDC there, and the worker follows 1Click to delivery.
import { NETWORKS } from "@tegata/config"
import { ftTransfer, isRegistered, type Operator } from "@tegata/core/near"
import {
  OneClickError,
  type QuoteRequest,
  type QuoteResponse,
  requestQuote,
  submitDeposit,
  swapStatus,
  verifyQuote,
} from "@tegata/core/oneclick"
import { type Db, schema } from "@tegata/db"
import { and, eq, inArray } from "drizzle-orm"

import { createRelayDraft } from "./relays.ts"

const { payouts, relays } = schema

/** Long enough to review and approve; 1Click refunds to the business if nothing arrives by then. */
const PAYOUT_WINDOW_MS = 30 * 60_000
const SLIPPAGE_BPS = 100
const STABLE_SLIPPAGE_BPS = 10
const IMPLICIT = /^[0-9a-f]{64}$/
const OPEN = ["sending", "processing"] as const

export class PayoutError extends Error {
  constructor(
    readonly code: "no_route" | "not_live" | "not_found" | "wrong_state",
    message: string,
  ) {
    super(message)
  }
}

function payoutRequest(input: {
  senderId: string
  amount: bigint
  destinationAsset: string
  recipient: string
  stable: boolean
  dry: boolean
}): QuoteRequest {
  return {
    dry: input.dry,
    swapType: "EXACT_INPUT",
    slippageTolerance: input.stable ? STABLE_SLIPPAGE_BPS : SLIPPAGE_BPS,
    originAsset: `nep141:${NETWORKS.mainnet.usdc}`,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: input.destinationAsset,
    amount: input.amount.toString(),
    // If the swap can't complete, the USDC comes back to the business.
    refundTo: input.senderId,
    refundType: "ORIGIN_CHAIN",
    recipient: input.recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + PAYOUT_WINDOW_MS).toISOString(),
  }
}

function friendly(error: unknown): string {
  const text = (error instanceof Error ? error.message : "").toLowerCase()
  if (text.includes("recipient") || text.includes("not valid"))
    return "That address doesn't look right for this chain."
  if (text.includes("low") || text.includes("minimum") || text.includes("amount"))
    return "That amount is below this route's minimum. Send a little more."
  return "NEAR Intents can't price that route right now. Try another coin or chain."
}

/** What arrives, before anything is committed (a dry quote: no deposit address). */
export async function previewPayout(
  input: {
    senderId: string
    amount: bigint
    destinationAsset: string
    recipient: string
    stable: boolean
  },
  apiKey?: string,
) {
  try {
    const response = await requestQuote(payoutRequest({ ...input, dry: true }), apiKey)
    return {
      amountOutFormatted: response.quote.amountOutFormatted,
      minAmountOut: response.quote.minAmountOut,
      amountOutUsd: response.quote.amountOutUsd,
      timeEstimate: response.quote.timeEstimate ?? null,
    }
  } catch (error) {
    throw new PayoutError("no_route", friendly(error))
  }
}

/**
 * Commit to a payout: a signed quote with its own deposit address, and the gas-free transfer for the business to
 * approve. Nothing moves until that approval is relayed.
 */
export async function createPayout(
  db: Db,
  input: {
    workspaceId: string
    userId: string
    senderId: string
    publicKey: string
    kind: "send" | "payroll" | "refund" | "move_out"
    amount: bigint
    destinationAsset: string
    symbol: string
    chain: string
    recipient: string
    stable: boolean
    reference?: string
  },
  apiKey?: string,
) {
  let response: QuoteResponse
  try {
    response = await requestQuote(payoutRequest({ ...input, dry: false }), apiKey)
  } catch (error) {
    throw new PayoutError(
      "no_route",
      error instanceof OneClickError ? friendly(error) : friendly(null),
    )
  }
  const echo = response.quoteRequest
  const deposit = response.quote.depositAddress ?? ""
  const honest =
    verifyQuote(response) &&
    echo.originAsset === `nep141:${NETWORKS.mainnet.usdc}` &&
    echo.amount === input.amount.toString() &&
    echo.recipient === input.recipient &&
    echo.swapType === "EXACT_INPUT" &&
    response.quote.amountIn === input.amount.toString() &&
    IMPLICIT.test(deposit)
  if (!honest) throw new PayoutError("no_route", "NEAR Intents' quote didn't check out. Try again.")

  const [payout] = await db
    .insert(payouts)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      network: "mainnet",
      kind: input.kind,
      senderId: input.senderId,
      amount: input.amount,
      destinationAsset: input.destinationAsset,
      symbol: input.symbol,
      chain: input.chain,
      recipient: input.recipient,
      amountOutFormatted: response.quote.amountOutFormatted,
      quote: response,
      depositAddress: deposit,
      deadline: new Date(echo.deadline),
      reference: input.reference ?? null,
    })
    .returning()
  if (!payout) throw new Error("Could not save the payout")
  // No memo: 1Click's NEAR deposit addresses take none. The address alone ties the transfer to this payout.
  const { relayId, draft } = await createRelayDraft(db, {
    userId: input.userId,
    network: "mainnet",
    purpose: `payout:${payout.id}`,
    senderId: input.senderId,
    receiverId: NETWORKS.mainnet.usdc,
    publicKey: input.publicKey,
    calls: [ftTransfer(deposit, input.amount)],
  })
  await db.update(payouts).set({ relayId }).where(eq(payouts.id, payout.id))
  return { payout: { ...payout, relayId }, relayId, draft }
}

const payoutIdOf = (purpose: string) =>
  purpose.startsWith("payout:") ? purpose.slice("payout:".length) : null

/**
 * Before the worker relays a payout's transfer: the deposit address must be registered on USDC, or the transfer would
 * fail. The operator pays the 0.00125 NEAR storage in its own transaction. Safe to repeat.
 */
export async function registerPayoutAddress(db: Db, operator: Operator, relayId: string) {
  const [relay] = await db.select().from(relays).where(eq(relays.id, relayId))
  const id = relay ? payoutIdOf(relay.purpose) : null
  if (!id) return
  const [payout] = await db.select().from(payouts).where(eq(payouts.id, id))
  if (!payout?.depositAddress) return
  const usdc = NETWORKS[payout.network].usdc
  if (await isRegistered(payout.network, usdc, payout.depositAddress)) return
  const result = await operator.registerOnUsdc(payout.depositAddress)
  if (result.status !== "success")
    throw new Error(`Registering the deposit address failed: ${result.error ?? result.status}`)
}

/** After the relay: the transfer landed (tell 1Click, start following it) or nothing moved. */
export async function settlePayoutRelay(
  db: Db,
  relayId: string,
  relayerId: string,
  apiKey?: string,
): Promise<string | null> {
  const [relay] = await db.select().from(relays).where(eq(relays.id, relayId))
  const id = relay ? payoutIdOf(relay.purpose) : null
  if (!relay || !id) return null
  if (relay.status === "success" && relay.txHash) {
    const [payout] = await db
      .update(payouts)
      .set({ status: "sending", txHash: relay.txHash })
      .where(and(eq(payouts.id, id), eq(payouts.status, "drafted")))
      .returning()
    if (payout?.depositAddress) {
      // The outer transaction is the relayer's, so that is the sender 1Click looks up on NEAR.
      await submitDeposit(
        {
          txHash: relay.txHash,
          depositAddress: payout.depositAddress,
          nearSenderAccount: relayerId,
        },
        apiKey,
      )
    }
    return id
  }
  if (relay.status === "failed" || relay.status === "expired") {
    await db
      .update(payouts)
      .set({
        status: "failed",
        error: relay.error ?? "NEAR didn't accept the transfer. Nothing moved.",
      })
      .where(and(eq(payouts.id, id), eq(payouts.status, "drafted")))
  }
  return null
}

export function payoutsToPoll(db: Db) {
  return db
    .select({ id: payouts.id })
    .from(payouts)
    .where(inArray(payouts.status, [...OPEN]))
}

export type PayoutPoll = "pending" | "delivered" | "refunded" | "failed"

/** Read 1Click once for a payout on its way. Safe to repeat. */
export async function pollPayout(db: Db, id: string, apiKey?: string): Promise<PayoutPoll> {
  const [payout] = await db.select().from(payouts).where(eq(payouts.id, id))
  if (!payout?.depositAddress || !OPEN.includes(payout.status as (typeof OPEN)[number]))
    return "pending"
  const status = await swapStatus(payout.depositAddress, apiKey)
  if (!status) return "pending"
  const destination = status.swapDetails?.destinationChainTxHashes?.[0]?.hash ?? null
  if (status.status === "SUCCESS") {
    await db
      .update(payouts)
      .set({
        status: "delivered",
        swapStatus: status.status,
        destinationTx: destination,
        deliveredAt: new Date(),
      })
      .where(and(eq(payouts.id, id), inArray(payouts.status, [...OPEN])))
    return "delivered"
  }
  if (status.status === "REFUNDED" || status.status === "FAILED") {
    await db
      .update(payouts)
      .set({
        status: status.status === "REFUNDED" ? "refunded" : "failed",
        swapStatus: status.status,
        error:
          status.status === "REFUNDED"
            ? "Couldn't deliver; the USDC came back to your balance"
            : "NEAR Intents couldn't complete it",
      })
      .where(and(eq(payouts.id, id), inArray(payouts.status, [...OPEN])))
    return status.status === "REFUNDED" ? "refunded" : "failed"
  }
  await db
    .update(payouts)
    .set({
      swapStatus: status.status,
      status: status.status === "PENDING_DEPOSIT" ? "sending" : "processing",
    })
    .where(and(eq(payouts.id, id), inArray(payouts.status, [...OPEN])))
  return "pending"
}

export async function getPayout(db: Db, workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(payouts)
    .where(and(eq(payouts.id, id), eq(payouts.workspaceId, workspaceId)))
  return row ?? null
}
