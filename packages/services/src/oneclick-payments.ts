// Live pay-ins from any chain through NEAR Intents 1Click (plan 6.8 AB; context/09-realworld-money/live-1click-notes.md).
// The payer picks a coin and chain and gives an address there for refunds; Tegata asks 1Click for an EXACT_OUTPUT quote
// (the business receives exactly the amount, in USDC on NEAR), checks 1Click signed it, and shows the deposit address.
// The worker polls 1Click; "paid" is still decided on NEAR: the delivery transaction must carry a USDC transfer to the
// business for the full amount.
import { NETWORKS } from "@tegata/config"
import { readUsdcTransfers } from "@tegata/core/near"
import {
  isTerminal,
  OneClickError,
  type QuoteResponse,
  requestQuote,
  type StatusResponse,
  swapStatus,
  verifyQuote,
} from "@tegata/core/oneclick"
import { type Db, schema } from "@tegata/db"
import { and, eq, inArray } from "drizzle-orm"

import { applyPayment, PaymentError, publicRequest, startAttempt } from "./payments.ts"

const { payments } = schema

/** The payer's window, as 1Click's merchant reference uses (5 min to pay + 15 min of buffer). */
const PAYER_WINDOW_MS = 20 * 60_000
/** Stablecoin to stablecoin barely moves: 0.1% instead of 1% keeps the "send this much" honest. */
const STABLE_SLIPPAGE_BPS = 10
const VOLATILE_SLIPPAGE_BPS = 100
/** After the payer's window 1Click keeps the address for 72 h; after that nothing more can arrive. */
const ADDRESS_LIFE_MS = 72 * 3_600_000
const NEARBLOCKS: Record<"mainnet" | "testnet", string> = {
  mainnet: "https://api.nearblocks.io",
  testnet: "https://api-testnet.nearblocks.io",
}
const OPEN = ["awaiting", "detected", "settling"] as const

/** Start a Live payment from another chain: a signed 1Click deposit address for exactly what the business is owed. */
export async function startOneClickPayment(
  db: Db,
  input: {
    token: string
    /** The 1Click asset the payer sends, from /v0/tokens. */
    originAsset: string
    /** True for USDC/USDT-style coins: the quote can use a tight slippage. */
    stable: boolean
    refundTo: string
    amount?: bigint
    apiKey?: string
  },
) {
  const found = await publicRequest(db, input.token)
  if (!found) throw new PaymentError("not_found", "This pay link doesn't exist")
  if (found.request.network !== "mainnet") {
    throw new PaymentError(
      "no_route",
      "Paying from other chains runs in Live: NEAR Intents has no testnet",
    )
  }
  const payment = await startAttempt(db, {
    token: input.token,
    rail: "oneclick",
    amount: input.amount,
    payer: input.refundTo,
  })
  const deadline = new Date(Date.now() + PAYER_WINDOW_MS).toISOString()
  let response: QuoteResponse
  try {
    response = await requestQuote(
      {
        dry: false,
        swapType: "EXACT_OUTPUT",
        slippageTolerance: input.stable ? STABLE_SLIPPAGE_BPS : VOLATILE_SLIPPAGE_BPS,
        originAsset: input.originAsset,
        depositType: "ORIGIN_CHAIN",
        destinationAsset: `nep141:${NETWORKS.mainnet.usdc}`,
        amount: payment.amount.toString(),
        refundTo: input.refundTo,
        refundType: "ORIGIN_CHAIN",
        recipient: payment.receiverId,
        recipientType: "DESTINATION_CHAIN",
        deadline,
      },
      input.apiKey,
    )
  } catch (error) {
    const message =
      error instanceof OneClickError ? error.message : "NEAR Intents didn't answer. Try again."
    await db
      .update(payments)
      .set({ status: "failed", error: message.slice(0, 300) })
      .where(eq(payments.id, payment.id))
    throw new PaymentError("no_route", friendly(message))
  }
  // Only a quote 1Click signed, for this business, this amount and USDC on NEAR, ever reaches the payer.
  const echo = response.quoteRequest
  const honest =
    verifyQuote(response) &&
    echo.recipient === payment.receiverId &&
    echo.amount === payment.amount.toString() &&
    echo.destinationAsset === `nep141:${NETWORKS.mainnet.usdc}` &&
    echo.swapType === "EXACT_OUTPUT" &&
    Boolean(response.quote.depositAddress)
  if (!honest) {
    await db
      .update(payments)
      .set({ status: "failed", error: "The quote didn't check out" })
      .where(eq(payments.id, payment.id))
    throw new PaymentError("no_route", "NEAR Intents' quote didn't check out. Try again.")
  }
  const [row] = await db
    .update(payments)
    .set({
      quote: response,
      depositAddress: response.quote.depositAddress ?? null,
      deadline: new Date(echo.deadline),
      refundTo: input.refundTo,
      assetIn: input.originAsset,
      amountIn: response.quote.amountIn,
      swapStatus: "PENDING_DEPOSIT",
    })
    .where(eq(payments.id, payment.id))
    .returning()
  if (!row) throw new Error("Could not save the quote")
  return { payment: row, quote: response.quote, deadline: echo.deadline }
}

/** 1Click's refusals, in the payer's words. */
function friendly(message: string): string {
  const text = message.toLowerCase()
  if (text.includes("too low") || text.includes("minimum") || text.includes("amount"))
    return "That amount is below this route's minimum. Try a larger amount or another coin."
  if (text.includes("refundto") || text.includes("not valid"))
    return "That refund address doesn't look right for this chain."
  return "NEAR Intents can't price that route right now. Try another coin or chain."
}

/** Live pay-ins still waiting on 1Click (the worker polls each). */
export function oneClickToPoll(db: Db) {
  return db
    .select({
      id: payments.id,
      depositAddress: payments.depositAddress,
      deadline: payments.deadline,
    })
    .from(payments)
    .where(and(eq(payments.rail, "oneclick"), inArray(payments.status, [...OPEN])))
}

export type PollResult = "pending" | "succeeded" | "refunded" | "failed" | "expired"

/**
 * Read 1Click once and move the payment on. Safe to run any number of times. Succeeds only when NEAR shows the
 * delivery: a USDC transfer to the business for at least the amount, in the transaction 1Click names.
 */
export async function pollOneClickPayment(
  db: Db,
  paymentId: string,
  apiKey?: string,
): Promise<PollResult> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))
  if (!payment?.depositAddress || !OPEN.includes(payment.status as (typeof OPEN)[number]))
    return "pending"
  const status = await swapStatus(payment.depositAddress, apiKey)
  if (!status) {
    if (payment.deadline && Date.now() > payment.deadline.getTime() + ADDRESS_LIFE_MS) {
      await close(db, payment.id, "expired", "Nothing arrived at the deposit address")
      return "expired"
    }
    return "pending"
  }
  const origin = status.swapDetails?.originChainTxHashes?.[0]?.hash ?? null
  await db
    .update(payments)
    .set({
      swapStatus: status.status,
      originTx: origin ?? payment.originTx,
      // Seen on the payer's chain → detected; converting → settling. Paid only below, from NEAR.
      status: status.status === "PENDING_DEPOSIT" ? "awaiting" : "detected",
    })
    .where(and(eq(payments.id, payment.id), inArray(payments.status, [...OPEN])))

  if (status.status === "REFUNDED") {
    await close(db, payment.id, "refunded", refundReason(status))
    return "refunded"
  }
  if (status.status === "FAILED") {
    await close(
      db,
      payment.id,
      "failed",
      "NEAR Intents couldn't complete it; the payer is refunded",
    )
    return "failed"
  }
  if (status.status !== "SUCCESS" || !isTerminal(status.status)) return "pending"

  const delivery = status.swapDetails?.destinationChainTxHashes?.[0]?.hash
  if (!delivery) return "pending"
  const signer = await txSigner(payment.network, delivery)
  if (!signer) return "pending"
  const read = await readUsdcTransfers(payment.network, delivery, signer)
  if (read.state === "pending") return "pending"
  // An ft_transfer event is only logged by a receipt that ran; other parts of a solver's batch don't change this one.
  const paid = read.transfers.find((t) => t.to === payment.receiverId && t.amount >= payment.amount)
  if (!paid) return "pending"
  await db.transaction(async (tx) => {
    const [settled] = await tx
      .update(payments)
      .set({ status: "succeeded", txHash: delivery, settledAt: new Date(), error: null })
      .where(and(eq(payments.id, payment.id), inArray(payments.status, [...OPEN])))
      .returning()
    if (settled) await applyPayment(tx, settled)
  })
  return "succeeded"
}

async function close(db: Db, id: string, status: "refunded" | "failed" | "expired", error: string) {
  await db
    .update(payments)
    .set({ status, error })
    .where(and(eq(payments.id, id), inArray(payments.status, [...OPEN])))
}

function refundReason(status: StatusResponse): string {
  const amount = status.swapDetails?.refundedAmountFormatted
  return amount
    ? `Refunded ${amount} to the payer (${status.swapDetails?.refundReason ?? "not completed in time"})`
    : "Refunded to the payer"
}

/** Who signed a NEAR transaction (RPC needs it to look the transaction up). */
async function txSigner(network: "mainnet" | "testnet", hash: string): Promise<string | null> {
  try {
    const response = await fetch(`${NEARBLOCKS[network]}/v3/txns/${hash}`)
    if (!response.ok) return null
    const data = (await response.json()) as { txns?: { signer_account_id?: string }[] }
    return data.txns?.[0]?.signer_account_id ?? null
  } catch {
    return null
  }
}

/** What the pay page shows while a Live payment is in flight. */
export function oneClickView(payment: typeof payments.$inferSelect) {
  const quote = payment.quote as QuoteResponse | null
  return {
    depositAddress: payment.depositAddress,
    depositMemo: quote?.quote.depositMemo ?? null,
    amountIn: payment.amountIn,
    amountInFormatted: quote?.quote.amountInFormatted ?? null,
    minAmountIn: quote?.quote.minAmountIn ?? null,
    assetIn: payment.assetIn,
    refundTo: payment.refundTo,
    deadline: payment.deadline?.toISOString() ?? null,
    swapStatus: payment.swapStatus,
    originTx: payment.originTx,
    timeEstimate: quote?.quote.timeEstimate ?? null,
  }
}
