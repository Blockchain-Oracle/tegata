// Split pots: the account holder's own share of every payment in, set aside as Tax and Savings on the one NEAR
// account. Pots are labels kept here; the money never leaves the account, so splitting needs no signature and
// Tegata holds nothing. Spendable is what the account holds less the pots.
import type { NetworkId } from "@tegata/config"
import { type Db, schema } from "@tegata/db"
import { and, desc, eq, inArray, sql } from "drizzle-orm"

import type { Conn } from "./events.ts"

const { splitRules, pots, potMoves, accounts, workspaces } = schema

export type PotKind = "tax" | "savings"
const KINDS: PotKind[] = ["tax", "savings"]
/** Never more than nine tenths of a payment set aside: something is always left to spend. */
const MAX_SPLIT_BPS = 9000

export class PotError extends Error {
  constructor(
    readonly code: "bad_input" | "not_found",
    message: string,
  ) {
    super(message)
  }
}

/** The rule and the pots for one business on one network, with what's spendable of `balance` (USDC on NEAR). */
export async function potsView(db: Db, workspaceId: string, network: NetworkId, balance: bigint) {
  const [rule] = await db
    .select()
    .from(splitRules)
    .where(and(eq(splitRules.workspaceId, workspaceId), eq(splitRules.network, network)))
  let rows = await db
    .select()
    .from(pots)
    .where(and(eq(pots.workspaceId, workspaceId), eq(pots.network, network)))
  // Money left the account some other way (a NEAR wallet, a send larger than what was spendable): the pots can't
  // hold more than the account does, so they shrink in proportion, and each shrink is recorded.
  const total = rows.reduce((sum, p) => sum + p.balance, 0n)
  if (total > balance && total > 0n) {
    await db.transaction(async (tx) => {
      for (const pot of rows) {
        const next = (pot.balance * (balance < 0n ? 0n : balance)) / total
        const cut = next - pot.balance
        if (cut === 0n) continue
        await tx.update(pots).set({ balance: next }).where(eq(pots.id, pot.id))
        await tx.insert(potMoves).values({ potId: pot.id, amount: cut, reason: "shrink" })
      }
    })
    rows = await db
      .select()
      .from(pots)
      .where(and(eq(pots.workspaceId, workspaceId), eq(pots.network, network)))
  }
  const of = (kind: PotKind) => rows.find((p) => p.kind === kind)?.balance ?? 0n
  const tax = of("tax")
  const savings = of("savings")
  const spendable = balance - tax - savings
  const recent = rows.length
    ? await db
        .select({ move: potMoves, kind: pots.kind })
        .from(potMoves)
        .innerJoin(pots, eq(pots.id, potMoves.potId))
        .where(
          inArray(
            potMoves.potId,
            rows.map((p) => p.id),
          ),
        )
        .orderBy(desc(potMoves.createdAt))
        .limit(8)
    : []
  return {
    rule: {
      on: rule?.on ?? false,
      taxBps: rule?.taxBps ?? 0,
      savingsBps: rule?.savingsBps ?? 0,
    },
    tax,
    savings,
    spendable: spendable < 0n ? 0n : spendable,
    balance,
    recent: recent.map((r) => ({
      kind: r.kind,
      amount: r.move.amount,
      reason: r.move.reason,
      sourceType: r.move.sourceType,
      at: r.move.createdAt,
    })),
  }
}

/** Switch the split on or off and set its shares. Turning it on never touches money already in. */
export async function setSplitRule(
  db: Db,
  workspaceId: string,
  network: NetworkId,
  input: { on: boolean; taxBps: number; savingsBps: number },
) {
  const valid = (bps: number) => Number.isInteger(bps) && bps >= 0 && bps <= MAX_SPLIT_BPS
  if (!valid(input.taxBps) || !valid(input.savingsBps))
    throw new PotError("bad_input", "Use whole percentages from 0 to 90")
  if (input.taxBps + input.savingsBps > MAX_SPLIT_BPS)
    throw new PotError("bad_input", "Tax and savings together can be at most 90%")
  if (input.on && input.taxBps + input.savingsBps === 0)
    throw new PotError("bad_input", "Set a share for tax or savings first")
  const values = { workspaceId, network, ...input }
  await db
    .insert(splitRules)
    .values(values)
    .onConflictDoUpdate({ target: [splitRules.workspaceId, splitRules.network], set: input })
  return input
}

async function potFor(conn: Conn, workspaceId: string, network: NetworkId, kind: PotKind) {
  await conn.insert(pots).values({ workspaceId, network, kind }).onConflictDoNothing()
  const [pot] = await conn
    .select()
    .from(pots)
    .where(and(eq(pots.workspaceId, workspaceId), eq(pots.network, network), eq(pots.kind, kind)))
  if (!pot) throw new Error("Could not open the pot")
  return pot
}

/**
 * A payment in settled: set the rule's shares aside, once per payment (the move is keyed by its source). Called inside
 * the settling transaction, so a payment and its split land together.
 */
export async function applySplit(
  conn: Conn,
  input: {
    workspaceId: string
    network: NetworkId
    amount: bigint
    sourceType: "payment" | "payslip"
    sourceId: string
  },
) {
  const [rule] = await conn
    .select()
    .from(splitRules)
    .where(
      and(eq(splitRules.workspaceId, input.workspaceId), eq(splitRules.network, input.network)),
    )
  if (!rule?.on || input.amount <= 0n) return
  for (const kind of KINDS) {
    const bps = kind === "tax" ? rule.taxBps : rule.savingsBps
    const share = (input.amount * BigInt(bps)) / 10_000n
    if (share <= 0n) continue
    const pot = await potFor(conn, input.workspaceId, input.network, kind)
    const [moved] = await conn
      .insert(potMoves)
      .values({
        potId: pot.id,
        amount: share,
        reason: "split",
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      })
      .onConflictDoNothing()
      .returning()
    if (moved)
      await conn
        .update(pots)
        .set({ balance: sql`${pots.balance} + ${share.toString()}` })
        .where(eq(pots.id, pot.id))
  }
}

/** Pay landing in a person's own Tegata account: their own rule splits it (never the employer's). */
export async function applySplitToAccount(
  conn: Conn,
  input: {
    accountId: string
    network: NetworkId
    amount: bigint
    sourceType: "payslip"
    sourceId: string
  },
) {
  const [owner] = await conn
    .select({ workspaceId: workspaces.id })
    .from(accounts)
    .innerJoin(workspaces, eq(workspaces.ownerId, accounts.userId))
    .where(and(eq(accounts.accountId, input.accountId), eq(accounts.network, input.network)))
  if (!owner) return
  await applySplit(conn, { ...input, workspaceId: owner.workspaceId })
}

/**
 * Move money between a pot and spending, by hand: out of a pot up to what it holds, into a pot up to what's
 * spendable. Only labels change; the money stays on the account.
 */
export async function movePot(
  db: Db,
  input: {
    workspaceId: string
    network: NetworkId
    kind: PotKind
    direction: "to_spending" | "to_pot"
    amount: bigint
    spendable: bigint
  },
) {
  if (input.amount <= 0n) throw new PotError("bad_input", "Enter an amount above $0")
  return db.transaction(async (tx) => {
    const pot = await potFor(tx, input.workspaceId, input.network, input.kind)
    if (input.direction === "to_spending" && input.amount > pot.balance)
      throw new PotError("bad_input", "That's more than the pot holds")
    if (input.direction === "to_pot" && input.amount > input.spendable)
      throw new PotError("bad_input", "That's more than you have to spend")
    const signed = input.direction === "to_spending" ? -input.amount : input.amount
    await tx
      .update(pots)
      .set({ balance: sql`${pots.balance} + ${signed.toString()}` })
      .where(eq(pots.id, pot.id))
    await tx.insert(potMoves).values({ potId: pot.id, amount: signed, reason: "manual" })
    return { kind: input.kind, moved: signed }
  })
}
