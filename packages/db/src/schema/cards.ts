// Cards a business has linked: a Gnosis Pay card account on the Gnosis chain, topped up from NEAR
// through NEAR Intents. Balances are read live from the chain, never stored.
import { sql } from "drizzle-orm"
import { index, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { createdAt, id, money, updatedAt } from "./columns.ts"
import { network, relays, workspaces } from "./identity.ts"
import { people } from "./payroll.ts"

export const cards = pgTable(
  "cards",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    provider: text().notNull().default("gnosis_pay"),
    /** The card account (a Safe on Gnosis), lower-cased. */
    account: text().notNull(),
    label: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("cards_account_idx").on(table.workspaceId, table.network, table.account),
    index("cards_workspace_idx").on(table.workspaceId, table.network),
  ],
)

/**
 * making: Tegata asked the issuer, the money is on its way onto it · active · frozen · removed (ended for good) ·
 * failed: the issuer couldn't make it (the money comes back).
 */
export const issuedCardStatus = pgEnum("issued_card_status", [
  "making",
  "active",
  "frozen",
  "removed",
  "failed",
])

/**
 * A card Tegata issued: a virtual Visa for the owner or a person, with its own balance that the
 * business fills from its USDC on NEAR. The number never touches Tegata: only the last four, from the issuer.
 */
export const issuedCards = pgTable(
  "issued_cards",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    provider: text().notNull().default("bitnob"),
    /** The issuer's ids, once it made them. */
    providerCardId: text(),
    providerCustomerId: text(),
    /** The person it's for; null is the owner's own card. */
    personId: uuid().references(() => people.id, { onDelete: "set null" }),
    holderName: text().notNull(),
    nickname: text().notNull(),
    /** The face colour: ink for the owner, a story colour per person (kept everywhere). */
    tone: text().notNull(),
    last4: text(),
    status: issuedCardStatus().notNull().default("making"),
    /** Who froze it: only the owner can undo an owner's freeze. */
    frozenBy: text(),
    /** USDC base units a month; null is no limit (a prepaid card can't spend more than is on it anyway). */
    monthlyLimit: money(),
    /** What's on the card, as the issuer last said (base units). */
    onCard: money().notNull().default(sql`0`),
    error: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("issued_cards_provider_idx").on(table.provider, table.providerCardId),
    index("issued_cards_workspace_idx").on(table.workspaceId, table.network, table.createdAt),
  ],
)

/** in: money onto the card (and the first fill when it's made) · out: moved back to the balance. */
export const cardMoveDirection = pgEnum("card_move_direction", ["in", "out"])
/** drafted → sent (on NEAR) → done (the issuer moved it) | failed (the dollars come back). */
export const cardMoveStatus = pgEnum("card_move_status", ["drafted", "sent", "done", "failed"])

/**
 * Money onto or off a card. In: the business's gas-free USDC transfer to Tegata's card reserve on NEAR, then the issuer
 * raises the card by the same amount. Out: the issuer lowers the card, then Tegata's operator sends the USDC back.
 */
export const cardMoves = pgTable(
  "card_moves",
  {
    id: id(),
    cardId: uuid()
      .notNull()
      .references(() => issuedCards.id, { onDelete: "cascade" }),
    direction: cardMoveDirection().notNull(),
    amount: money().notNull(),
    status: cardMoveStatus().notNull().default("drafted"),
    relayId: uuid().references(() => relays.id),
    /** The NEAR transaction: the business's transfer in, or the operator's back. */
    txHash: text(),
    error: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("card_moves_card_idx").on(table.cardId, table.createdAt)],
)

/** A purchase on a card, from the issuer's webhooks (stored once per event). */
export const cardPurchases = pgTable(
  "card_purchases",
  {
    id: id(),
    cardId: uuid()
      .notNull()
      .references(() => issuedCards.id, { onDelete: "cascade" }),
    eventId: text().notNull(),
    /** authorization · settlement · reversal · declined. */
    kind: text().notNull(),
    merchant: text(),
    amount: money(),
    reason: text(),
    raw: jsonb(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("card_purchases_event_idx").on(table.eventId),
    index("card_purchases_card_idx").on(table.cardId, table.createdAt),
  ],
)
