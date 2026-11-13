// Money out to another chain through NEAR Intents 1Click.
// The business sends exactly `amount` of USDC (EXACT_INPUT) to a fresh 1Click deposit address on NEAR. Tegata's
// operator registers that address on USDC in its own transaction (a deposit above 1 yocto never rides inside a user's
// relayed action), the business's gas-free action sends the USDC there, and the worker follows 1Click to delivery.
import { maxConversionExtra, NETWORKS } from "@tegata/config"
import { ftTransfer, isRegistered, type Operator, usdcBalance } from "@tegata/core/near"
import {
  OneClickError,
  type QuoteRequest,
  type QuoteResponse,
  quoteProblem,
  requestQuote,
  submitDeposit,
  swapStatus,
  usdcToTokenUnits,
  verifyQuote,
} from "@tegata/core/oneclick"
import { type Db, schema } from "@tegata/db"
import { and, eq, inArray, sql } from "drizzle-orm"

import { applyRefund } from "./books.ts"
import { createRelayDraft } from "./relays.ts"

const { payouts, relays, payments, requests, accounts } = schema

/** Long enough to review and approve; 1Click refunds to the business if nothing arrives by then. */
const PAYOUT_WINDOW_MS = 30 * 60_000
const SLIPPAGE_BPS = 100
const STABLE_SLIPPAGE_BPS = 10
const IMPLICIT = /^[0-9a-f]{64}$/
const OPEN = ["sending", "processing"] as const

export class PayoutError extends Error {
  constructor(
    readonly code: "no_route" | "not_live" | "not_found" | "wrong_state" | "bad_input",
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
  /** The exact amount to deliver, in the destination coin's own units (EXACT_OUTPUT). */
  amountOut?: bigint
}): QuoteRequest {
  return {
    dry: input.dry,
    swapType: input.amountOut === undefined ? "EXACT_INPUT" : "EXACT_OUTPUT",
    slippageTolerance: input.stable ? STABLE_SLIPPAGE_BPS : SLIPPAGE_BPS,
    originAsset: `nep141:${NETWORKS.mainnet.usdc}`,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: input.destinationAsset,
    amount: (input.amountOut ?? input.amount).toString(),
    // If the swap can't complete, the USDC comes back to the business.
    refundTo: input.senderId,
    refundType: "ORIGIN_CHAIN",
    recipient: input.recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + PAYOUT_WINDOW_MS).toISOString(),
  }
}

/** 1Click's refusal of a payout, for the person sending it. */
const friendly = (error: unknown) =>
  quoteProblem(error instanceof Error ? error.message : null, "This coin and chain")

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

export interface PayoutInput {
  workspaceId: string
  userId: string
  senderId: string
  kind: "send" | "payroll" | "refund" | "move_out"
  amount: bigint
  destinationAsset: string
  symbol: string
  chain: string
  recipient: string
  stable: boolean
  reference?: string
  /**
   * Deliver exactly `amount` dollars in a stablecoin (EXACT_OUTPUT), with the coin's decimals on its chain: a payroll
   * row, so the person receives their pay in full. The business sends what the quote asks, a little more.
   */
  exactOut?: { decimals: number }
}

/**
 * A signed quote with its own deposit address on NEAR, checked and saved as a drafted payout: EXACT_INPUT (the
 * business sends exactly `amount`), or EXACT_OUTPUT for a stablecoin payroll row (the person receives exactly
 * `amount`; the payout's own amount is what the business sends). The caller drafts the transfer to that address
 * (alone, or inside a payroll batch).
 */
export async function quotePayout(db: Db, input: PayoutInput, apiKey?: string) {
  const amountOut = input.exactOut
    ? usdcToTokenUnits(input.amount, input.exactOut.decimals)
    : undefined
  let response: QuoteResponse
  try {
    response = await requestQuote(payoutRequest({ ...input, dry: false, amountOut }), apiKey)
  } catch (error) {
    throw new PayoutError(
      "no_route",
      error instanceof OneClickError ? friendly(error) : friendly(null),
    )
  }
  const echo = response.quoteRequest
  const deposit = response.quote.depositAddress ?? ""
  const amountIn = BigInt(response.quote.amountIn ?? "0")
  const honest =
    verifyQuote(response) &&
    echo.originAsset === `nep141:${NETWORKS.mainnet.usdc}` &&
    echo.recipient === input.recipient &&
    IMPLICIT.test(deposit) &&
    (amountOut === undefined
      ? echo.swapType === "EXACT_INPUT" &&
        echo.amount === input.amount.toString() &&
        amountIn === input.amount
      : echo.swapType === "EXACT_OUTPUT" &&
        echo.amount === amountOut.toString() &&
        amountIn >= input.amount)
  if (!honest) throw new PayoutError("no_route", "NEAR Intents' quote didn't check out. Try again.")
  // Delivering exactly the pay costs a little more; past the cap, say so instead of paying it.
  if (amountOut !== undefined && amountIn - input.amount > maxConversionExtra(input.amount))
    throw new PayoutError(
      "no_route",
      `Delivering on ${input.chain} costs ${(Number(amountIn - input.amount) / 1e6).toFixed(2)} extra right now. Try another chain, or try again later.`,
    )
  const [payout] = await db
    .insert(payouts)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      network: "mainnet",
      kind: input.kind,
      senderId: input.senderId,
      // What the business sends: the amount, or for an exact delivery what the quote asks.
      amount: amountOut === undefined ? input.amount : amountIn,
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
  return { payout, deposit }
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
  const { payout, deposit } = await quotePayout(db, input, apiKey)
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

/** A payout carried by another relay (a payroll batch) landed on NEAR: tell 1Click and start following it. */
export async function markPayoutSent(
  db: Db,
  input: { payoutId: string; txHash: string; relayerId: string },
  apiKey?: string,
) {
  const [payout] = await db
    .update(payouts)
    .set({ status: "sending", txHash: input.txHash })
    .where(and(eq(payouts.id, input.payoutId), eq(payouts.status, "drafted")))
    .returning()
  if (payout?.depositAddress)
    await submitDeposit(
      {
        txHash: input.txHash,
        depositAddress: payout.depositAddress,
        nearSenderAccount: input.relayerId,
      },
      apiKey,
    ).catch(() => {
      // 1Click finds the deposit on its own too; telling it only makes it faster.
    })
  return payout ?? null
}

/** Payouts drafted for a batch that never landed: nothing moved, so they end here. */
export async function failDraftedPayouts(db: Db, payoutIds: string[], error: string) {
  if (!payoutIds.length) return
  await db
    .update(payouts)
    .set({ status: "failed", error })
    .where(and(inArray(payouts.id, payoutIds), eq(payouts.status, "drafted")))
}

/** Register 1Click deposit addresses on USDC (operator-paid) so transfers to them can land. Safe to repeat. */
export async function registerDepositAddresses(db: Db, operator: Operator, payoutIds: string[]) {
  if (!payoutIds.length) return
  const rows = await db.select().from(payouts).where(inArray(payouts.id, payoutIds))
  for (const payout of rows) {
    if (!payout.depositAddress || payout.status !== "drafted") continue
    const usdc = NETWORKS[payout.network].usdc
    if (await isRegistered(payout.network, usdc, payout.depositAddress)) continue
    const result = await operator.registerOnUsdc(payout.depositAddress)
    if (result.status !== "success")
      throw new Error(`Registering the deposit address failed: ${result.error ?? result.status}`)
  }
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
    await db.transaction(async (tx) => {
      const [delivered] = await tx
        .update(payouts)
        .set({
          status: "delivered",
          swapStatus: status.status,
          destinationTx: destination,
          deliveredAt: new Date(),
        })
        .where(and(eq(payouts.id, id), inArray(payouts.status, [...OPEN])))
        .returning()
      // A refund to the payer's chain counts against the payment once it has arrived, not when it left.
      if (delivered?.kind === "refund" && delivered.reference)
        await applyRefund(tx, {
          paymentId: delivered.reference,
          amount: delivered.amount,
          txHash: delivered.txHash,
          dedupe: `payout:${delivered.id}`,
          receiptUrl: delivered.relayId ? `/r/send/${delivered.relayId}` : null,
        })
    })
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

/**
 * Refund a payment that came from another chain: the USDC goes back through NEAR Intents to the payer's own address,
 * in the coin they sent. `describe` names the payer's coin and chain from its 1Click asset id.
 */
export async function draftChainRefund(
  db: Db,
  input: {
    workspaceId: string
    userId: string
    publicKey: string
    paymentId: string
    amount: bigint
  },
  describe: (assetId: string) => Promise<{ symbol: string; chain: string; stable: boolean } | null>,
  apiKey?: string,
) {
  const [row] = await db
    .select({ payment: payments, workspaceId: requests.workspaceId })
    .from(payments)
    .innerJoin(requests, eq(requests.id, payments.requestId))
    .where(eq(payments.id, input.paymentId))
  if (row?.workspaceId !== input.workspaceId) throw new PayoutError("not_found", "No such payment")
  const { payment } = row
  if (payment.rail !== "oneclick" || !payment.refundTo || !payment.assetIn)
    throw new PayoutError("wrong_state", "This payment didn't come from another chain")
  if (payment.status !== "succeeded")
    throw new PayoutError("wrong_state", "Only a received payment can be refunded")
  // What's left, less refunds already on their way.
  const [inFlight] = await db
    .select({ total: sql<string>`coalesce(sum(${payouts.amount}), 0)` })
    .from(payouts)
    .where(
      and(
        eq(payouts.kind, "refund"),
        eq(payouts.reference, payment.id),
        inArray(payouts.status, ["drafted", "sending", "processing"]),
      ),
    )
  const left = payment.amount - payment.refunded - BigInt(inFlight?.total ?? "0")
  if (input.amount <= 0n || input.amount > left)
    throw new PayoutError("bad_input", `Refund up to ${(Number(left) / 1e6).toFixed(2)}`)
  const route = await describe(payment.assetIn)
  if (!route) throw new PayoutError("no_route", "The payer's coin isn't offered right now")
  const [owner] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, input.userId), eq(accounts.network, "mainnet")))
  if (!owner?.readyAt) throw new PayoutError("not_live", "Your Live account is still opening")
  if ((await usdcBalance("mainnet", owner.accountId)) < input.amount)
    throw new PayoutError("bad_input", "Not enough dollars in your balance for this refund")
  return createPayout(
    db,
    {
      workspaceId: input.workspaceId,
      userId: input.userId,
      senderId: owner.accountId,
      publicKey: input.publicKey,
      kind: "refund",
      amount: input.amount,
      destinationAsset: payment.assetIn,
      symbol: route.symbol,
      chain: route.chain,
      recipient: payment.refundTo,
      stable: route.stable,
      reference: payment.id,
    },
    apiKey,
  )
}

export async function getPayout(db: Db, workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(payouts)
    .where(and(eq(payouts.id, id), eq(payouts.workspaceId, workspaceId)))
  return row ?? null
}
