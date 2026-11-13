// Linked cards (plan 6.8 AD): a Gnosis Pay card account a business tops up from NEAR through NEAR Intents.
import type { NetworkId } from "@tegata/config"
import { isGnosisAddress } from "@tegata/core/gnosis"
import { type Db, schema } from "@tegata/db"
import { and, desc, eq } from "drizzle-orm"

const { cards, payouts } = schema

export class CardError extends Error {
  constructor(
    readonly code: "bad_input" | "not_found",
    message: string,
  ) {
    super(message)
  }
}

export function listCards(db: Db, workspaceId: string, network: NetworkId) {
  return db
    .select()
    .from(cards)
    .where(and(eq(cards.workspaceId, workspaceId), eq(cards.network, network)))
    .orderBy(desc(cards.createdAt))
}

export async function linkCard(
  db: Db,
  input: { workspaceId: string; network: NetworkId; account: string; label: string },
) {
  const account = input.account.trim().toLowerCase()
  if (!isGnosisAddress(account))
    throw new CardError(
      "bad_input",
      "That isn't a Gnosis address: it starts 0x and has 40 more characters",
    )
  const label = input.label.trim().slice(0, 40) || "Gnosis Pay card"
  const [row] = await db
    .insert(cards)
    .values({ workspaceId: input.workspaceId, network: input.network, account, label })
    .onConflictDoUpdate({
      target: [cards.workspaceId, cards.network, cards.account],
      set: { label },
    })
    .returning()
  return row
}

export async function unlinkCard(db: Db, workspaceId: string, id: string) {
  const [row] = await db
    .delete(cards)
    .where(and(eq(cards.id, id), eq(cards.workspaceId, workspaceId)))
    .returning()
  if (!row) throw new CardError("not_found", "No such card")
}

/** Top-ups sent to a card account: payouts to its address (Live, through NEAR Intents). */
export function cardTopUps(db: Db, workspaceId: string, account: string) {
  return db
    .select()
    .from(payouts)
    .where(and(eq(payouts.workspaceId, workspaceId), eq(payouts.recipient, account)))
    .orderBy(desc(payouts.createdAt))
    .limit(20)
}
