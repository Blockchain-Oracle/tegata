// Spend cards Tegata issues (plan 6.8 AD, job 1; context/09-realworld-money/cards-ux-brief.md, cards-v2.md): a virtual
// Visa for the owner or a person, issued by Bitnob, with its own balance filled from the business's USDC on NEAR.
//
// Money in: the business approves one gas-free USDC transfer to Tegata's card reserve (the operator) with memo
// `tegata:card:<move>`; once the USDC event is read on NEAR, the worker asks Bitnob to raise the card by the same amount
// (or, for a new card, to issue it with that first fill). Money out: Bitnob lowers the card, then the operator sends the
// USDC back to the business. If Bitnob refuses a fill, the USDC goes back. The card number never touches Tegata.
import { NETWORKS, type NetworkId } from "@tegata/config"
import {
  approveCardholder,
  BITNOB_MIN_FUNDING,
  type BitnobClient,
  BitnobError,
  createCard,
  createCardholder,
  getCard,
  moveCardBalance,
  readCardEvent,
  setCardLimit,
  setCardStatus,
  simulateCardEvent,
  terminateCard,
} from "@tegata/core/bitnob"
import {
  ftTransfer,
  matchingTransfer,
  type Operator,
  readUsdcTransfers,
  toAction,
  usdcBalance,
} from "@tegata/core/near"
import { type Db, schema } from "@tegata/db"
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm"

import { CardError } from "./cards.ts"
import { createRelayDraft } from "./relays.ts"

const { issuedCards, cardMoves, cardPurchases, people, accounts, users, relays } = schema

export const cardMemo = (moveId: string) => `tegata:card:${moveId}`
const PERSON_TONES = ["matcha", "sora", "sakura", "kin", "ai"] as const

type IssuedCard = typeof issuedCards.$inferSelect

async function ownCard(db: Db, workspaceId: string, id: string) {
  const [card] = await db
    .select()
    .from(issuedCards)
    .where(and(eq(issuedCards.id, id), eq(issuedCards.workspaceId, workspaceId)))
  if (!card) throw new CardError("not_found", "No such card")
  return card
}

const startOfMonth = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/** The business's cards, newest first, with what each spent this month. Cards never paid for aren't shown. */
export async function listIssuedCards(db: Db, workspaceId: string, network: NetworkId) {
  const rows = await db
    .select()
    .from(issuedCards)
    .where(and(eq(issuedCards.workspaceId, workspaceId), eq(issuedCards.network, network)))
    .orderBy(desc(issuedCards.createdAt))
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const [moves, spent, latest] = await Promise.all([
    db
      .select({ cardId: cardMoves.cardId, status: cardMoves.status })
      .from(cardMoves)
      .where(inArray(cardMoves.cardId, ids)),
    db
      .select({
        cardId: cardPurchases.cardId,
        total: sql<string>`coalesce(sum(${cardPurchases.amount}), 0)`,
      })
      .from(cardPurchases)
      .where(
        and(
          inArray(cardPurchases.cardId, ids),
          eq(cardPurchases.kind, "settlement"),
          gte(cardPurchases.createdAt, startOfMonth()),
        ),
      )
      .groupBy(cardPurchases.cardId),
    db
      .select()
      .from(cardPurchases)
      .where(inArray(cardPurchases.cardId, ids))
      .orderBy(desc(cardPurchases.createdAt))
      .limit(10),
  ])
  // A card whose first fill was never approved never really existed: leave it out.
  const paid = new Set(moves.filter((m) => m.status !== "drafted").map((m) => m.cardId))
  const spentBy = new Map(spent.map((s) => [s.cardId, BigInt(s.total)]))
  return {
    cards: rows
      .filter((card) => card.status !== "failed" && (card.status !== "making" || paid.has(card.id)))
      .map((card) => ({ card, spentThisMonth: spentBy.get(card.id) ?? 0n })),
    purchases: latest,
  }
}

export async function getIssuedCard(db: Db, workspaceId: string, id: string) {
  const card = await ownCard(db, workspaceId, id)
  const [purchases, moves] = await Promise.all([
    db
      .select()
      .from(cardPurchases)
      .where(eq(cardPurchases.cardId, id))
      .orderBy(desc(cardPurchases.createdAt))
      .limit(10),
    db
      .select()
      .from(cardMoves)
      .where(eq(cardMoves.cardId, id))
      .orderBy(desc(cardMoves.createdAt))
      .limit(10),
  ])
  return { card, purchases, moves }
}

/** The owner's cards are ink; a person keeps the colour of their first card, and new people take the next one. */
async function toneFor(db: Db, workspaceId: string, network: NetworkId, personId: string | null) {
  if (!personId) return "ink"
  const existing = await db
    .select({ personId: issuedCards.personId, tone: issuedCards.tone })
    .from(issuedCards)
    .where(
      and(
        eq(issuedCards.workspaceId, workspaceId),
        eq(issuedCards.network, network),
        isNotNull(issuedCards.personId),
      ),
    )
  const own = existing.find((c) => c.personId === personId)
  if (own) return own.tone
  const people = new Set(existing.map((c) => c.personId))
  return PERSON_TONES[people.size % PERSON_TONES.length] ?? "matcha"
}

/**
 * Start a card: saved as "making" with its first fill, and the gas-free transfer of that fill to Tegata's card reserve
 * for the owner to approve. The card is issued once the transfer lands (the worker, `fundCardMove`).
 */
export async function draftNewCard(
  db: Db,
  input: {
    workspaceId: string
    userId: string
    publicKey: string
    senderId: string
    network: NetworkId
    personId: string | null
    nickname: string
    monthlyLimit: bigint | null
    startWith: bigint
  },
) {
  const nickname = input.nickname.trim().slice(0, 24) || "Card"
  if (input.startWith < BITNOB_MIN_FUNDING)
    throw new CardError("bad_input", "Start the card with at least $2.00")
  if (input.monthlyLimit !== null && input.monthlyLimit <= 0n)
    throw new CardError("bad_input", "Set a limit above zero, or no limit")
  if ((await usdcBalance(input.network, input.senderId)) < input.startWith)
    throw new CardError("bad_input", "Not enough dollars in your balance")
  let holderName: string
  if (input.personId) {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, input.personId), eq(people.workspaceId, input.workspaceId)))
    if (!person) throw new CardError("not_found", "That person isn't on your team")
    if (!person.email)
      throw new CardError(
        "bad_input",
        `Add ${person.name}'s email first: the card is in their name`,
      )
    holderName = person.name
  } else {
    // The owner's own card is in the business's name, like a company card.
    const [business] = await db
      .select({ name: schema.workspaces.name })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, input.workspaceId))
    holderName = business?.name ?? "Your business"
  }
  const tone = await toneFor(db, input.workspaceId, input.network, input.personId)
  const [card] = await db
    .insert(issuedCards)
    .values({
      workspaceId: input.workspaceId,
      network: input.network,
      personId: input.personId,
      holderName,
      nickname,
      tone,
      monthlyLimit: input.monthlyLimit,
    })
    .returning()
  if (!card) throw new Error("Could not save the card")
  const { move, relayId, draft } = await draftMoveIn(db, {
    ...input,
    card,
    amount: input.startWith,
  })
  return { card, move, relayId, draft, operator: NETWORKS[input.network].operator }
}

async function draftMoveIn(
  db: Db,
  input: {
    userId: string
    publicKey: string
    senderId: string
    network: NetworkId
    card: IssuedCard
    amount: bigint
  },
) {
  const [move] = await db
    .insert(cardMoves)
    .values({ cardId: input.card.id, direction: "in", amount: input.amount })
    .returning()
  if (!move) throw new Error("Could not save the move")
  const operator = NETWORKS[input.network].operator
  const { relayId, draft } = await createRelayDraft(db, {
    userId: input.userId,
    network: input.network,
    purpose: `card:${move.id}`,
    senderId: input.senderId,
    receiverId: NETWORKS[input.network].usdc,
    publicKey: input.publicKey,
    calls: [ftTransfer(operator, input.amount, cardMemo(move.id))],
  })
  await db.update(cardMoves).set({ relayId }).where(eq(cardMoves.id, move.id))
  return { move: { ...move, relayId }, relayId, draft }
}

/** Add money to a card the business already has: the same gas-free transfer, then the issuer raises the card. */
export async function draftAddMoney(
  db: Db,
  input: {
    workspaceId: string
    userId: string
    publicKey: string
    senderId: string
    cardId: string
    amount: bigint
  },
) {
  const card = await ownCard(db, input.workspaceId, input.cardId)
  if (card.status === "removed" || card.status === "failed" || !card.providerCardId)
    throw new CardError("bad_input", "This card can't take money")
  if (input.amount < BITNOB_MIN_FUNDING) throw new CardError("bad_input", "Add at least $2.00")
  if ((await usdcBalance(card.network, input.senderId)) < input.amount)
    throw new CardError("bad_input", "Not enough dollars in your balance")
  const drafted = await draftMoveIn(db, { ...input, network: card.network, card })
  return { ...drafted, operator: NETWORKS[card.network].operator }
}

/** Worker, after a `card:` relay is final: the move is sent once its USDC event is read on NEAR. */
export async function settleCardRelay(db: Db, relayId: string, operatorId: string) {
  const [relay] = await db.select().from(relays).where(eq(relays.id, relayId))
  if (!relay?.purpose.startsWith("card:")) return null
  const id = relay.purpose.slice("card:".length)
  const [move] = await db.select().from(cardMoves).where(eq(cardMoves.id, id))
  if (move?.status !== "drafted") return null
  if (relay.status === "failed" || relay.status === "expired") {
    await db
      .update(cardMoves)
      .set({
        status: "failed",
        error: relay.error ?? "NEAR didn't accept the transfer. Nothing moved.",
      })
      .where(eq(cardMoves.id, id))
    await db
      .update(issuedCards)
      .set({ status: "failed", error: "The first fill didn't go through" })
      .where(and(eq(issuedCards.id, move.cardId), eq(issuedCards.status, "making")))
    return null
  }
  if (relay.status !== "success" || !relay.txHash) return null
  const read = await readUsdcTransfers(relay.network, relay.txHash, operatorId)
  if (read.state === "pending") return null
  const landed =
    read.ok &&
    matchingTransfer(read.transfers, {
      to: NETWORKS[relay.network].operator,
      amount: move.amount,
      memo: cardMemo(move.id),
    })
  await db
    .update(cardMoves)
    .set(
      landed
        ? { status: "sent", txHash: relay.txHash }
        : { status: "failed", error: "The transfer didn't land on NEAR. Nothing moved." },
    )
    .where(and(eq(cardMoves.id, id), eq(cardMoves.status, "drafted")))
  return landed ? id : null
}

/** The cardholder at Bitnob: reused from their other cards, else made (and, in the Sandbox, approved at once). */
async function cardholderFor(db: Db, bitnob: BitnobClient, card: IssuedCard) {
  const [other] = await db
    .select({ id: issuedCards.providerCustomerId })
    .from(issuedCards)
    .where(
      and(
        eq(issuedCards.workspaceId, card.workspaceId),
        eq(issuedCards.network, card.network),
        isNotNull(issuedCards.providerCustomerId),
        card.personId
          ? eq(issuedCards.personId, card.personId)
          : sql`${issuedCards.personId} is null`,
      ),
    )
    .limit(1)
  if (other?.id) return other.id
  let email: string | null = null
  if (card.personId) {
    const [person] = await db.select().from(people).where(eq(people.id, card.personId))
    email = person?.email ?? null
  } else {
    const [row] = await db
      .select({ email: users.email })
      .from(issuedCards)
      .innerJoin(schema.workspaces, eq(schema.workspaces.id, issuedCards.workspaceId))
      .innerJoin(users, eq(users.id, schema.workspaces.ownerId))
      .where(eq(issuedCards.id, card.id))
    email = row?.email ?? null
  }
  if (!email) throw new CardError("bad_input", "The cardholder needs an email")
  const [first, ...rest] = card.holderName.trim().split(/\s+/)
  const made = await createCardholder(bitnob, {
    firstName: first ?? card.holderName,
    lastName: rest.join(" ") || first || card.holderName,
    email,
  })
  const customerId = made.customer_id ?? made.id
  if (!customerId) throw new CardError("bad_input", "Bitnob didn't return the cardholder")
  if (card.network === "testnet") await approveCardholder(bitnob, customerId).catch(() => undefined)
  await db
    .update(issuedCards)
    .set({ providerCustomerId: customerId })
    .where(eq(issuedCards.id, card.id))
  return customerId
}

/**
 * Worker: a move whose USDC reached the reserve. A new card is issued with it as its first fill; an existing card is
 * raised by it. If Bitnob refuses, the operator sends the USDC back to the business.
 */
export async function fundCardMove(
  db: Db,
  bitnob: BitnobClient,
  operator: Operator,
  moveId: string,
  webhookUrl: string,
) {
  const [move] = await db.select().from(cardMoves).where(eq(cardMoves.id, moveId))
  if (move?.status !== "sent" || move.direction !== "in") return null
  const [card] = await db.select().from(issuedCards).where(eq(issuedCards.id, move.cardId))
  if (!card) return null
  try {
    if (!card.providerCardId) {
      const customerId = await cardholderFor(db, bitnob, card)
      const made = await createCard(bitnob, {
        customerId,
        amount: move.amount,
        reference: `tg_${card.id.replace(/-/g, "")}`,
        monthlyLimit: card.monthlyLimit,
        webhookUrl,
      })
      await db
        .update(issuedCards)
        .set({
          providerCardId: made.id,
          last4: made.last_four_digit || null,
          status: made.last_four_digit ? "active" : "making",
          onCard: move.amount,
          updatedAt: new Date(),
        })
        .where(eq(issuedCards.id, card.id))
    } else {
      await moveCardBalance(bitnob, card.providerCardId, {
        type: "fund",
        amount: move.amount,
        reference: `tgin${move.id.replace(/-/g, "")}`,
      })
      await db
        .update(issuedCards)
        .set({ onCard: sql`${issuedCards.onCard} + ${move.amount}`, updatedAt: new Date() })
        .where(eq(issuedCards.id, card.id))
    }
    await db.update(cardMoves).set({ status: "done" }).where(eq(cardMoves.id, move.id))
    return "done"
  } catch (error) {
    const reason =
      error instanceof BitnobError || error instanceof CardError
        ? error.message
        : "The card issuer didn't answer"
    await returnToBusiness(db, operator, card, move.amount, `tegata:cardback:${move.id}`)
    await db
      .update(cardMoves)
      .set({ status: "failed", error: `Returned to your balance: ${reason}` })
      .where(eq(cardMoves.id, move.id))
    if (!card.providerCardId)
      await db
        .update(issuedCards)
        .set({ status: "failed", error: reason })
        .where(eq(issuedCards.id, card.id))
    return "failed"
  }
}

/** The operator sends USDC from the card reserve back to the business's NEAR account. */
async function returnToBusiness(
  db: Db,
  operator: Operator,
  card: IssuedCard,
  amount: bigint,
  memo: string,
) {
  const [owner] = await db
    .select({ accountId: accounts.accountId })
    .from(schema.workspaces)
    .innerJoin(accounts, eq(accounts.userId, schema.workspaces.ownerId))
    .where(and(eq(schema.workspaces.id, card.workspaceId), eq(accounts.network, card.network)))
  if (!owner) throw new Error("The business has no account on this network")
  const result = await operator.send(NETWORKS[card.network].usdc, [
    toAction(ftTransfer(owner.accountId, amount, memo)),
  ])
  if (result.status !== "success")
    throw new Error(`Sending it back failed: ${result.error ?? result.status}`)
  return result.hash
}

/**
 * Ask to move unused money back. The web app only records it; the worker (which alone holds the operator's keys) has
 * the issuer lower the card and the operator return the USDC (`processMoveOut`).
 */
export async function requestMoveBack(
  db: Db,
  input: { workspaceId: string; cardId: string; amount: bigint },
) {
  const card = await ownCard(db, input.workspaceId, input.cardId)
  if (!card.providerCardId) throw new CardError("bad_input", "This card has nothing to move back")
  if (input.amount <= 0n || input.amount > card.onCard)
    throw new CardError("bad_input", "Move back at most what's on the card")
  const [move] = await db
    .insert(cardMoves)
    .values({ cardId: card.id, direction: "out", amount: input.amount, status: "sent" })
    .returning()
  if (!move) throw new Error("Could not save the move")
  return move
}

/** Worker: the issuer lowers the card, then the operator sends the USDC back to the business. */
export async function processMoveOut(
  db: Db,
  bitnob: BitnobClient,
  operator: Operator,
  moveId: string,
) {
  const [move] = await db.select().from(cardMoves).where(eq(cardMoves.id, moveId))
  if (move?.status !== "sent" || move.direction !== "out") return null
  const [card] = await db.select().from(issuedCards).where(eq(issuedCards.id, move.cardId))
  if (!card?.providerCardId) return null
  try {
    await moveCardBalance(bitnob, card.providerCardId, {
      type: "withdraw",
      amount: move.amount,
      reference: `tgout${move.id.replace(/-/g, "")}`,
    })
  } catch (error) {
    await db
      .update(cardMoves)
      .set({
        status: "failed",
        error: `Nothing moved: ${error instanceof Error ? error.message : "the issuer refused"}`,
      })
      .where(eq(cardMoves.id, move.id))
    return "failed"
  }
  await db
    .update(issuedCards)
    .set({
      onCard: sql`greatest(${issuedCards.onCard} - ${move.amount}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(issuedCards.id, card.id))
  const hash = await returnToBusiness(db, operator, card, move.amount, `tegata:cardback:${move.id}`)
  await db.update(cardMoves).set({ status: "done", txHash: hash }).where(eq(cardMoves.id, move.id))
  return "done"
}

export async function freezeCard(
  db: Db,
  bitnob: BitnobClient,
  input: { workspaceId: string; cardId: string; frozen: boolean; by: "owner" | "person" },
) {
  const card = await ownCard(db, input.workspaceId, input.cardId)
  if (!card.providerCardId || (card.status !== "active" && card.status !== "frozen"))
    throw new CardError("bad_input", "This card can't be frozen right now")
  // Whoever froze it decides: a person can't undo the owner's freeze.
  if (!input.frozen && card.frozenBy === "owner" && input.by === "person")
    throw new CardError("bad_input", "Only the owner can unfreeze this card")
  await setCardStatus(bitnob, card.providerCardId, input.frozen ? "frozen" : "active")
  const [row] = await db
    .update(issuedCards)
    .set({
      status: input.frozen ? "frozen" : "active",
      frozenBy: input.frozen ? input.by : null,
      updatedAt: new Date(),
    })
    .where(eq(issuedCards.id, card.id))
    .returning()
  return row
}

export async function setMonthlyLimit(
  db: Db,
  bitnob: BitnobClient,
  input: { workspaceId: string; cardId: string; monthlyLimit: bigint | null },
) {
  const card = await ownCard(db, input.workspaceId, input.cardId)
  if (!card.providerCardId) throw new CardError("bad_input", "This card isn't ready yet")
  if (input.monthlyLimit !== null && input.monthlyLimit <= 0n)
    throw new CardError("bad_input", "Set a limit above zero, or no limit")
  await setCardLimit(bitnob, card.providerCardId, input.monthlyLimit)
  const [row] = await db
    .update(issuedCards)
    .set({ monthlyLimit: input.monthlyLimit, updatedAt: new Date() })
    .where(eq(issuedCards.id, card.id))
    .returning()
  return row
}

export async function renameCard(
  db: Db,
  input: { workspaceId: string; cardId: string; nickname: string },
) {
  const nickname = input.nickname.trim().slice(0, 24)
  if (!nickname) throw new CardError("bad_input", "Give the card a name")
  await ownCard(db, input.workspaceId, input.cardId)
  const [row] = await db
    .update(issuedCards)
    .set({ nickname, updatedAt: new Date() })
    .where(eq(issuedCards.id, input.cardId))
    .returning()
  return row
}

/** Worker: remove a card for good. Anything left on it moves back first, then the issuer ends it. */
export async function removeCard(db: Db, bitnob: BitnobClient, operator: Operator, cardId: string) {
  const [card] = await db.select().from(issuedCards).where(eq(issuedCards.id, cardId))
  if (!card || card.status === "removed") return
  if (card.providerCardId && card.onCard > 0n) {
    const move = await requestMoveBack(db, {
      workspaceId: card.workspaceId,
      cardId: card.id,
      amount: card.onCard,
    })
    if ((await processMoveOut(db, bitnob, operator, move.id)) !== "done")
      throw new CardError("bad_input", "The money on the card couldn't be moved back. Try again.")
  }
  if (card.providerCardId) await terminateCard(bitnob, card.providerCardId)
  await db
    .update(issuedCards)
    .set({ status: "removed", updatedAt: new Date() })
    .where(eq(issuedCards.id, card.id))
}

/** Sandbox: a test purchase. Bitnob sends the authorization and its settlement to the card's webhook. */
export async function testPurchase(
  db: Db,
  bitnob: BitnobClient,
  input: { workspaceId: string; cardId: string },
) {
  const card = await ownCard(db, input.workspaceId, input.cardId)
  if (card.network !== "testnet")
    throw new CardError("bad_input", "Test purchases run in the Sandbox")
  if (!card.providerCardId) throw new CardError("bad_input", "This card isn't ready yet")
  await simulateCardEvent(bitnob, card.providerCardId, "authorization")
  await simulateCardEvent(bitnob, card.providerCardId, "settlement")
}

/** Bring a card's last four, status and balance up to date from the issuer. */
export async function syncIssuedCard(db: Db, bitnob: BitnobClient, cardId: string) {
  const [card] = await db.select().from(issuedCards).where(eq(issuedCards.id, cardId))
  if (!card?.providerCardId) return card ?? null
  const remote = await getCard(bitnob, card.providerCardId)
  const status = /frozen/i.test(remote.status)
    ? "frozen"
    : /terminat|cancel/i.test(remote.status)
      ? "removed"
      : /active/i.test(remote.status) && remote.last_four_digit
        ? "active"
        : card.status
  const [row] = await db
    .update(issuedCards)
    .set({
      last4: remote.last_four_digit || card.last4,
      status,
      onCard: remote.balance && /^\d+$/.test(remote.balance) ? BigInt(remote.balance) : card.onCard,
      updatedAt: new Date(),
    })
    .where(eq(issuedCards.id, card.id))
    .returning()
  return row
}

/** A Bitnob card webhook (signature checked by the route): purchases are stored once; the card is brought up to date. */
export async function applyCardWebhook(
  db: Db,
  bitnob: BitnobClient,
  body: Record<string, unknown>,
) {
  const event = readCardEvent(body)
  if (!event.cardId) return null
  const [card] = await db
    .select()
    .from(issuedCards)
    .where(eq(issuedCards.providerCardId, event.cardId))
  if (!card) return null
  if (event.type !== "created" && event.type !== "other")
    await db
      .insert(cardPurchases)
      .values({
        cardId: card.id,
        eventId: event.eventId,
        kind: event.type,
        merchant: event.merchant,
        amount: event.amount,
        reason: event.reason,
        raw: body,
      })
      .onConflictDoNothing()
  await syncIssuedCard(db, bitnob, card.id).catch(() => undefined)
  return { cardId: card.id, type: event.type }
}

/** Card moves waiting on the issuer: fills whose USDC landed, and moves back (the worker sweeps these). */
export function cardMovesToFund(db: Db) {
  return db
    .select({ id: cardMoves.id, network: issuedCards.network, direction: cardMoves.direction })
    .from(cardMoves)
    .innerJoin(issuedCards, eq(issuedCards.id, cardMoves.cardId))
    .where(eq(cardMoves.status, "sent"))
}
