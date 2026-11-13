// Spend cards on the server: Bitnob's client from env, and the views the Cards screens read.

import type { NetworkId } from "@tegata/config"
import { bitnobClient } from "@tegata/core/bitnob"
import { serverEnv } from "@tegata/env"
import { CardError, type getIssuedCard, type listIssuedCards } from "@tegata/services"

import type { CardMoveView, CardPurchaseView, IssuedCardView } from "@/lib/client/types"

/** Bitnob's client; the keys stay on the server. */
export function bitnob() {
  const env = serverEnv()
  if (!env.BITNOB_CLIENT_ID || !env.BITNOB_CLIENT_SECRET)
    throw new CardError("bad_input", "Cards aren't set up on this server yet")
  return bitnobClient(env.BITNOB_CLIENT_ID, env.BITNOB_CLIENT_SECRET)
}

/**
 * Whether cards can be issued on this network. Bitnob's keys here are sandbox keys, so cards run in the Sandbox
 * only: in Live a fill would move real USDC to the card reserve against a test card. Live opens with a production
 * key and Bitnob's own review.
 */
export const issuerReady = (network: NetworkId) => {
  const env = serverEnv()
  return Boolean(env.BITNOB_CLIENT_ID && env.BITNOB_CLIENT_SECRET) && network === "testnet"
}

type Listed = Exclude<Awaited<ReturnType<typeof listIssuedCards>>, never[]>
type Detail = Awaited<ReturnType<typeof getIssuedCard>>

export function issuedCardView(card: Detail["card"], spentThisMonth: bigint): IssuedCardView {
  return {
    id: card.id,
    personId: card.personId,
    holderName: card.holderName,
    nickname: card.nickname,
    tone: card.tone as IssuedCardView["tone"],
    last4: card.last4,
    status: card.status,
    frozenBy: (card.frozenBy as IssuedCardView["frozenBy"]) ?? null,
    monthlyLimit: card.monthlyLimit?.toString() ?? null,
    onCard: card.onCard.toString(),
    spentThisMonth: spentThisMonth.toString(),
    error: card.error,
    createdAt: card.createdAt.toISOString(),
  }
}

export function purchaseView(p: Listed["purchases"][number]): CardPurchaseView {
  return {
    id: p.id,
    cardId: p.cardId,
    kind: p.kind as CardPurchaseView["kind"],
    merchant: p.merchant,
    amount: p.amount?.toString() ?? null,
    reason: p.reason,
    createdAt: p.createdAt.toISOString(),
  }
}

export function moveView(m: Detail["moves"][number]): CardMoveView {
  return {
    id: m.id,
    direction: m.direction,
    amount: m.amount.toString(),
    status: m.status,
    txHash: m.txHash,
    error: m.error,
    createdAt: m.createdAt.toISOString(),
  }
}
