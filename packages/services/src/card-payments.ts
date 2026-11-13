// Pay by card: a payer's bank card buys USDC on NEAR through Transak, delivered to the business.
// One attempt per checkout, rail "card". Paid only when NEAR shows the USDC reaching the business, like every rail:
//  · Live (Transak production): Transak's own delivery transaction, read on NEAR for the full amount.
//  · Sandbox (Transak staging): staging orders to NEAR deliver nothing, so when Transak marks the order complete,
//    Tegata's operator sends the same amount of test USDC with the attempt's memo, and that transfer settles it. The
//    receipt says so.
import { NETWORKS, type NetworkId } from "@tegata/config"
import { ftTransfer, type Operator, toAction } from "@tegata/core/near"
import {
  CARD_FIAT,
  TRANSAK_CHARGED,
  TRANSAK_DONE,
  TRANSAK_FAILED,
  type TransakClient,
  TransakError,
} from "@tegata/core/transak"
import { type Db, schema } from "@tegata/db"
import { and, eq, inArray } from "drizzle-orm"

import { PaymentError, publicRequest, settlePayment, startAttempt } from "./payments.ts"

const { payments } = schema

/** A checkout the payer doesn't finish in this long is closed. */
const CARD_WINDOW_MS = 45 * 60_000
const OPEN = ["awaiting", "detected", "settling"] as const

/** Which network Transak's keys can take cards on: staging keys the Sandbox, production keys Live. */
export const cardNetwork = (transak: TransakClient): NetworkId =>
  transak.env === "production" ? "mainnet" : "testnet"

/** What the payer's card pays for this many dollars arriving, fee included, before they commit. */
export async function cardQuote(transak: TransakClient, amount: bigint) {
  const dollars = Number(amount) / 1_000_000
  try {
    const q = await transak.quote({ cryptoAmount: dollars })
    return { fiat: q.fiat, total: q.fiatAmount, fee: q.fee }
  } catch (error) {
    throw new PaymentError(
      "bad_amount",
      error instanceof TransakError && error.httpStatus < 500
        ? error.message
        : "Card payments are down right now. The other ways still work.",
    )
  }
}

/**
 * Start paying by card: an attempt, and a single-use Transak checkout locked to this payment (USDC on NEAR, the
 * business's account, the exact amount) for the page to open. Only the card is left for the payer to type.
 */
export async function startCardPayment(
  db: Db,
  transak: TransakClient,
  input: {
    token: string
    amount?: bigint
    payerEmail?: string
    appUrl: string
    /** The payer's IP, which Transak requires for a checkout session. */
    userIp?: string
  },
) {
  const found = await publicRequest(db, input.token)
  if (!found) throw new PaymentError("not_found", "This pay link doesn't exist")
  if (found.request.network !== cardNetwork(transak))
    throw new PaymentError(
      "closed",
      found.request.network === "mainnet"
        ? "Card payments in Live open after Transak's business review"
        : "Card payments here run in Live",
    )
  const payment = await startAttempt(db, {
    token: input.token,
    rail: "card",
    amount: input.amount,
    payerEmail: input.payerEmail,
  })
  const appUrl = input.appUrl.replace(/\/$/, "")
  const widgetUrl = await transak
    .widgetUrl(
      {
        referrerDomain: new URL(appUrl).hostname,
        productsAvailed: "BUY",
        cryptoCurrencyCode: "USDC",
        network: "near",
        cryptoAmount: Number(payment.amount) / 1_000_000,
        fiatCurrency: CARD_FIAT,
        paymentMethod: "credit_debit_card",
        walletAddress: payment.receiverId,
        disableWalletAddressForm: true,
        partnerOrderId: payment.id,
        redirectURL: `${appUrl}/pay/${input.token}?card=${payment.id}`,
        hideMenu: true,
        themeColor: "000000",
        ...(input.payerEmail ? { email: input.payerEmail } : {}),
      },
      { userIp: input.userIp },
    )
    .catch(async (error) => {
      await db
        .update(payments)
        .set({ status: "failed", error: "Card payments are down right now" })
        .where(eq(payments.id, payment.id))
      throw new PaymentError(
        "bad_amount",
        error instanceof TransakError
          ? error.message
          : "Card payments are down right now. The other ways still work.",
      )
    })
  await db
    .update(payments)
    .set({ deadline: new Date(Date.now() + CARD_WINDOW_MS) })
    .where(eq(payments.id, payment.id))
  return { payment, widgetUrl }
}

/** The page heard Transak's order id from the checkout (or the redirect): keep it so the worker can follow it. */
export async function setCardOrder(db: Db, paymentId: string, orderId: string) {
  const [row] = await db
    .update(payments)
    .set({ cardOrderId: orderId })
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.rail, "card"),
        inArray(payments.status, [...OPEN]),
      ),
    )
    .returning()
  return row ?? null
}

export function cardPaymentsToPoll(db: Db) {
  return db
    .select({ id: payments.id, network: payments.network })
    .from(payments)
    .where(and(eq(payments.rail, "card"), inArray(payments.status, [...OPEN])))
}

export type CardPoll = "pending" | "succeeded" | "failed" | "expired"

/** Plain words for Transak's ending states. */
function cardFailure(status: string, reason?: string) {
  if (status === "CANCELLED") return "The card payment was cancelled. Nothing was charged."
  if (status === "EXPIRED") return "The card checkout timed out. Nothing was charged."
  if (status === "REFUNDED") return "Transak refunded the card. Nothing reached the business."
  return reason
    ? `The card was declined: ${reason}`
    : "Your bank declined the card. Nothing was charged."
}

/**
 * Read Transak once and move the payment on; safe to repeat. Sandbox delivery needs the operator (the worker only).
 */
export async function pollCardPayment(
  db: Db,
  transak: TransakClient,
  operator: Operator | null,
  paymentId: string,
): Promise<CardPoll> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId))
  if (payment?.rail !== "card" || !OPEN.includes(payment.status as (typeof OPEN)[number]))
    return payment?.status === "succeeded" ? "succeeded" : "failed"
  if (!payment.cardOrderId) {
    if (payment.deadline && payment.deadline.getTime() < Date.now()) {
      await db
        .update(payments)
        .set({ status: "expired", error: "The card checkout wasn't finished" })
        .where(eq(payments.id, payment.id))
      return "expired"
    }
    return "pending"
  }
  const order = await transak.order(payment.cardOrderId).catch(() => null)
  if (!order) return "pending"
  if (order.partnerOrderId && order.partnerOrderId !== payment.id) {
    await db
      .update(payments)
      .set({ status: "failed", error: "That card order belongs to another payment" })
      .where(eq(payments.id, payment.id))
    return "failed"
  }
  if (TRANSAK_FAILED.has(order.status)) {
    await db
      .update(payments)
      .set({
        status: "failed",
        swapStatus: order.status,
        error: cardFailure(order.status, order.statusReason),
      })
      .where(eq(payments.id, payment.id))
    return "failed"
  }
  if (!TRANSAK_DONE.has(order.status)) {
    await db
      .update(payments)
      .set({
        swapStatus: order.status,
        status: TRANSAK_CHARGED.has(order.status) ? "settling" : payment.status,
      })
      .where(eq(payments.id, payment.id))
    return "pending"
  }

  // Completed. Sandbox: Tegata delivers the test USDC itself, with the memo, and that transfer settles it.
  if (payment.network === "testnet") {
    if (!operator) return "pending"
    let txHash = payment.txHash
    if (!txHash) {
      const result = await operator.send(
        NETWORKS.testnet.usdc,
        [toAction(ftTransfer(payment.receiverId, payment.amount, payment.memo))],
        async (tx) => {
          // Saved before broadcast, so a crash never sends twice.
          await db
            .update(payments)
            .set({
              txHash: tx.hash,
              swapStatus: order.status,
              status: "settling",
              quote: { order },
            })
            .where(eq(payments.id, payment.id))
        },
      )
      txHash = result.hash
    }
    const settled = await settlePayment(db, payment.id, txHash, operator.accountId)
    return settled === "succeeded" ? "succeeded" : settled === "failed" ? "failed" : "pending"
  }

  // Live: Transak's own delivery transaction to the business, read on NEAR for the full amount.
  if (!order.transactionHash || !order.fromWalletAddress) {
    await db
      .update(payments)
      .set({ swapStatus: order.status, status: "settling", quote: { order } })
      .where(eq(payments.id, payment.id))
    return "pending"
  }
  const settled = await settlePayment(
    db,
    payment.id,
    order.transactionHash,
    order.fromWalletAddress,
    {
      anyMemo: true,
    },
  )
  return settled === "succeeded" ? "succeeded" : settled === "failed" ? "failed" : "pending"
}
