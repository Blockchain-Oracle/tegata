import { LIMITS, type NetworkId } from "@tegata/config"
import {
  type CallSpec,
  type DelegateDraft,
  draftDelegate,
  nearProvider,
  type Operator,
  signatureFromBase64,
  signedDelegateAction,
  type TxResult,
  verifyDraftSignature,
} from "@tegata/core/near"
import { type Db, schema } from "@tegata/db"
import { and, count, desc, eq, gte, inArray, like } from "drizzle-orm"

const { relays } = schema

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

export class RelayError extends Error {
  constructor(
    readonly code: "rate_limited" | "not_found" | "bad_signature" | "wrong_state",
    message: string,
  ) {
    super(message)
  }
}

export interface RelayRequest {
  userId: string
  network: NetworkId
  /** What this is for, e.g. `send:<id>`. One relay per purpose: a retry reuses the row. */
  purpose: string
  senderId: string
  receiverId: string
  publicKey: string
  calls: CallSpec[]
}

/**
 * Build the gas-free action the user must sign and store it. The server chooses every
 * call; the client only signs what it is shown.
 */
export async function createRelayDraft(db: Db, request: RelayRequest) {
  await assertWithinLimits(db, request.userId)
  const draft = await draftDelegate(request)

  const [existing] = await db.select().from(relays).where(eq(relays.purpose, request.purpose))
  if (existing) {
    if (existing.userId !== request.userId) throw new RelayError("not_found", "Not your action")
    if (existing.status !== "drafted" && existing.status !== "expired") {
      throw new RelayError("wrong_state", "This action was already approved")
    }
    const [row] = await db
      .update(relays)
      .set({ draft, status: "drafted", signature: null, error: null })
      .where(eq(relays.id, existing.id))
      .returning()
    if (!row) throw new RelayError("not_found", "The action disappeared")
    return { relayId: row.id, draft }
  }

  const [row] = await db
    .insert(relays)
    .values({
      userId: request.userId,
      network: request.network,
      purpose: request.purpose,
      senderId: request.senderId,
      receiverId: request.receiverId,
      draft,
    })
    .returning()
  if (!row) throw new Error("Could not store the action")
  return { relayId: row.id, draft }
}

async function assertWithinLimits(db: Db, userId: string) {
  const since = (ms: number) => new Date(Date.now() - ms)
  const sponsored = inArray(relays.status, ["signed", "sent", "success", "failed", "unknown"])
  const [[hour], [day]] = await Promise.all([
    db
      .select({ n: count() })
      .from(relays)
      .where(and(eq(relays.userId, userId), sponsored, gte(relays.createdAt, since(HOUR_MS)))),
    db
      .select({ n: count() })
      .from(relays)
      .where(and(eq(relays.userId, userId), sponsored, gte(relays.createdAt, since(DAY_MS)))),
  ])
  if ((hour?.n ?? 0) >= LIMITS.relaysPerHour || (day?.n ?? 0) >= LIMITS.relaysPerDay) {
    throw new RelayError("rate_limited", "Too many actions in a short time. Try again later.")
  }
}

/** Store the user's signature after checking it against the stored draft. */
export async function submitRelaySignature(
  db: Db,
  input: { relayId: string; userId: string; signature: string },
) {
  const [row] = await db.select().from(relays).where(eq(relays.id, input.relayId))
  if (!row || row.userId !== input.userId) throw new RelayError("not_found", "No such action")
  if (row.status !== "drafted") throw new RelayError("wrong_state", "Already approved")
  const draft = row.draft as DelegateDraft
  if (!verifyDraftSignature(draft, signatureFromBase64(input.signature))) {
    throw new RelayError("bad_signature", "The signature does not match this action")
  }
  // Only a row that is still `drafted` moves on, so two submissions cannot both win.
  const [updated] = await db
    .update(relays)
    .set({ signature: input.signature, status: "signed" })
    .where(and(eq(relays.id, row.id), eq(relays.status, "drafted")))
    .returning()
  if (!updated) throw new RelayError("wrong_state", "Already approved")
  return updated
}

/**
 * Send a signed action through the operator, or pick it up after a crash. Safe to run any
 * number of times: the operator's transaction is saved before its first broadcast and only
 * those saved bytes are ever sent.
 */
export async function processRelay(db: Db, operator: Operator, relayId: string) {
  const [row] = await db.select().from(relays).where(eq(relays.id, relayId))
  if (!row) return undefined
  const draft = row.draft as DelegateDraft

  let result: TxResult
  if (row.status === "signed" && row.signature) {
    const action = signedDelegateAction(draft, signatureFromBase64(row.signature))
    result = await operator.relay(row.senderId, action, async (tx) => {
      await db
        .update(relays)
        .set({ status: "sent", txHash: tx.hash, txBytes: tx.bytes })
        .where(eq(relays.id, row.id))
    })
  } else if ((row.status === "sent" || row.status === "unknown") && row.txHash && row.txBytes) {
    result = await operator.resume(row.txHash, row.txBytes)
  } else {
    return row
  }

  let status: "success" | "failed" | "unknown" | "expired" = result.status
  if (status === "unknown" && (await delegateExpired(operator.network, draft))) {
    // The chain will now reject this delegate action, so it can never land.
    status = "expired"
  }
  const [updated] = await db
    .update(relays)
    .set({
      status,
      txHash: result.hash,
      error: result.error ?? null,
      tokensBurnt: result.tokensBurnt,
    })
    .where(eq(relays.id, row.id))
    .returning()
  return updated
}

async function delegateExpired(network: NetworkId, draft: DelegateDraft): Promise<boolean> {
  const block = await nearProvider(network).viewBlock({ finality: "final" })
  return BigInt(block.header.height) > BigInt(draft.maxBlockHeight)
}

/** Relays a worker should pick up when it starts: approved or mid-send. */
export async function unfinishedRelays(db: Db) {
  return db
    .select({ id: relays.id, network: relays.network })
    .from(relays)
    .where(inArray(relays.status, ["signed", "sent", "unknown"]))
}

export async function getRelay(db: Db, relayId: string, userId: string) {
  const [row] = await db
    .select()
    .from(relays)
    .where(and(eq(relays.id, relayId), eq(relays.userId, userId)))
  return row
}

export interface SendRow {
  id: string
  network: NetworkId
  to: string
  /** USDC base units. */
  amount: bigint
  status: (typeof relays.$inferSelect)["status"]
  txHash: string | null
  createdAt: Date
}

/** The person's one-off sends, newest first, read from the transfer each relay carries. */
export async function listSends(db: Db, userId: string, limit = 20): Promise<SendRow[]> {
  const rows = await db
    .select()
    .from(relays)
    .where(and(eq(relays.userId, userId), like(relays.purpose, "send:%")))
    .orderBy(desc(relays.createdAt))
    .limit(limit)
  return rows.flatMap((row) => {
    const call = (row.draft as DelegateDraft).calls[0]
    if (call?.method !== "ft_transfer") return []
    const args = JSON.parse(call.argsJson) as { receiver_id: string; amount: string }
    return [
      {
        id: row.id,
        network: row.network,
        to: args.receiver_id,
        amount: BigInt(args.amount),
        status: row.status,
        txHash: row.txHash,
        createdAt: row.createdAt,
      },
    ]
  })
}
