import { NETWORKS, TEST_DOLLARS } from "@tegata/config"
import {
  ftTransfer,
  matchingTransfer,
  type Operator,
  readUsdcTransfers,
  toAction,
  tokenBalance,
} from "@tegata/core/near"
import { type Db, schema } from "@tegata/db"
import { and, eq } from "drizzle-orm"

const { testDollars, accounts } = schema

/** Test dollars exist in Sandbox only. */
const NETWORK = "testnet" as const
/** A grant whose saved transaction NEAR still doesn't know after this long was never broadcast. */
const STALE_MS = 10 * 60_000

export class SandboxError extends Error {
  constructor(
    readonly code: "not_ready" | "already_today",
    message: string,
  ) {
    super(message)
  }
}

const utcDay = () => new Date().toISOString().slice(0, 10)

/** Ask for today's test dollars. A grant that failed earlier today can be asked for again. */
export async function requestTestDollars(db: Db, userId: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.network, NETWORK)))
  if (!account?.readyAt) throw new SandboxError("not_ready", "Your account is still being set up")
  const day = utcDay()
  const used = () =>
    new SandboxError("already_today", "You've had today's test dollars. More tomorrow.")

  const [existing] = await db
    .select()
    .from(testDollars)
    .where(and(eq(testDollars.userId, userId), eq(testDollars.day, day)))
  if (existing) {
    if (existing.status !== "failed") throw used()
    const [again] = await db
      .update(testDollars)
      .set({ status: "queued", error: null, txHash: null })
      .where(and(eq(testDollars.id, existing.id), eq(testDollars.status, "failed")))
      .returning()
    if (!again) throw used()
    return again
  }
  const [row] = await db
    .insert(testDollars)
    .values({ userId, accountId: account.accountId, amount: TEST_DOLLARS.units, day })
    .onConflictDoNothing()
    .returning()
  if (!row) throw used()
  return row
}

async function finish(db: Db, id: string, update: { status: "sent" | "failed"; error?: string }) {
  await db
    .update(testDollars)
    .set({ status: update.status, error: update.error ?? null })
    .where(and(eq(testDollars.id, id), eq(testDollars.status, "queued")))
}

/**
 * Send a queued grant from the operator (worker only). Safe to run again: the transaction hash is saved before it
 * is broadcast, and a grant with a saved hash is checked on NEAR, never sent a second time.
 */
export async function sendTestDollars(db: Db, operator: Operator, grantId: string) {
  const [grant] = await db.select().from(testDollars).where(eq(testDollars.id, grantId))
  if (grant?.status !== "queued") return grant?.status

  if (grant.txHash) {
    const read = await readUsdcTransfers(operator.network, grant.txHash, operator.accountId)
    if (read.state === "pending") {
      if (Date.now() - grant.updatedAt.getTime() > STALE_MS) {
        await finish(db, grant.id, {
          status: "failed",
          error: "We couldn't confirm the transfer. Ask again.",
        })
        return "failed"
      }
      return "queued"
    }
    const landed =
      read.ok &&
      matchingTransfer(read.transfers, {
        to: grant.accountId,
        amount: grant.amount,
        memo: TEST_DOLLARS.memo,
      })
    await finish(
      db,
      grant.id,
      landed ? { status: "sent" } : { status: "failed", error: "The transfer didn't land" },
    )
    return landed ? "sent" : "failed"
  }

  const usdc = NETWORKS[operator.network].usdc
  const stash = await tokenBalance(operator.network, usdc, operator.accountId)
  if (stash < grant.amount) {
    await finish(db, grant.id, {
      status: "failed",
      error: "The Sandbox stash is empty right now. Try again later.",
    })
    return "failed"
  }
  const result = await operator.send(
    usdc,
    [toAction(ftTransfer(grant.accountId, grant.amount, TEST_DOLLARS.memo))],
    async (tx) => {
      await db.update(testDollars).set({ txHash: tx.hash }).where(eq(testDollars.id, grant.id))
    },
  )
  if (result.status === "unknown") return "queued"
  await finish(
    db,
    grant.id,
    result.status === "success"
      ? { status: "sent" }
      : { status: "failed", error: "NEAR didn't accept the transfer" },
  )
  return result.status === "success" ? "sent" : "failed"
}

/** Grants still to send or confirm (the worker sweeps these at start). */
export function queuedTestDollars(db: Db) {
  return db.select({ id: testDollars.id }).from(testDollars).where(eq(testDollars.status, "queued"))
}

export async function testDollarsFor(db: Db, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(testDollars)
    .where(and(eq(testDollars.id, id), eq(testDollars.userId, userId)))
  return row
}
