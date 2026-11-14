import { LIMITS, type NetworkId } from "@tegata/config"
import {
  adoptWalletDelegate,
  type CallSpec,
  type DelegateDraft,
  draftDelegate,
  nearProvider,
  type Operator,
  signatureFromBase64,
  signedDelegateAction,
  type TxResult,
  verifyDraftSignature,
  WalletDelegateError,
} from "@tegata/core/near"
import { type Db, schema } from "@tegata/db"
import { and, count, desc, eq, gte, inArray, like, ne, or, sql } from "drizzle-orm"

const { relays, accounts, workspaces } = schema

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
  /** For drafts signed together: 1, 2, 3… in the order they will be relayed. */
  nonceOffset?: number
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
  input: {
    relayId: string
    userId: string
    /** Base64 signature over the draft's hash (a key held by Privy). */
    signature?: string
    /** Or a NEAR wallet's own signed delegate action for the draft (base64 borsh). */
    signedDelegate?: string
    /**
     * The purposes this caller may approve (prefixes). Checked before anything is stored: a signed row is relayed by
     * the worker's start-up sweep, so approving the wrong draft through the wrong door must never get that far.
     */
    purposes?: readonly string[]
  },
) {
  const [row] = await db.select().from(relays).where(eq(relays.id, input.relayId))
  if (!row || row.userId !== input.userId) throw new RelayError("not_found", "No such action")
  if (input.purposes && !input.purposes.some((prefix) => row.purpose.startsWith(prefix)))
    throw new RelayError("not_found", "That approval is for something else")
  if (row.status !== "drafted") throw new RelayError("wrong_state", "Already approved")
  let draft = row.draft as DelegateDraft
  let signature = input.signature ?? ""
  if (input.signedDelegate) {
    // A wallet signs with its own nonce, expiry and key: take those, but only for exactly the drafted action.
    try {
      ;({ draft, signature } = adoptWalletDelegate(draft, input.signedDelegate))
    } catch (error) {
      throw new RelayError(
        "bad_signature",
        error instanceof WalletDelegateError
          ? error.message
          : "The wallet's answer couldn't be read",
      )
    }
    if (!(await hasFullAccess(draft))) {
      throw new RelayError("bad_signature", "That key can't approve payments on this account")
    }
  } else if (!verifyDraftSignature(draft, signatureFromBase64(signature))) {
    throw new RelayError("bad_signature", "The signature does not match this action")
  }
  // Only a row that is still `drafted` moves on, so two submissions cannot both win.
  const [updated] = await db
    .update(relays)
    .set({ draft, signature, status: "signed" })
    .where(and(eq(relays.id, row.id), eq(relays.status, "drafted")))
    .returning()
  if (!updated) throw new RelayError("wrong_state", "Already approved")
  return updated
}

/** One approval of a drafted action: a Privy key's signature over its hash, or a NEAR wallet's own signed delegate. */
export interface Approval {
  relayId: string
  signature?: string
  signedDelegate?: string
}

/** True when the approval is for exactly this draft (checked before any of a batch is submitted). */
export function approvalMatches(draft: DelegateDraft, approval: Approval): boolean {
  try {
    if (approval.signedDelegate) return Boolean(adoptWalletDelegate(draft, approval.signedDelegate))
    return verifyDraftSignature(draft, signatureFromBase64(approval.signature ?? ""))
  } catch {
    return false
  }
}

/** A delegate signed by a function-call key would fail on chain with the operator's gas spent: check first. */
async function hasFullAccess(draft: DelegateDraft): Promise<boolean> {
  try {
    const key = await nearProvider(draft.network).viewAccessKey({
      accountId: draft.senderId,
      publicKey: draft.publicKey,
    })
    return key.permission === "FullAccess"
  } catch {
    return false
  }
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
/** Sends and refunds other Tegata users made to this person's accounts, newest first: the receiving side of Send. */
export async function listSendsIn(db: Db, userId: string, limit = 20) {
  const rows = await db
    .select({ relay: relays, from: workspaces.name })
    .from(relays)
    .innerJoin(accounts, and(eq(accounts.userId, userId), eq(accounts.network, relays.network)))
    .leftJoin(workspaces, eq(workspaces.ownerId, relays.userId))
    .where(
      and(
        eq(relays.status, "success"),
        ne(relays.userId, userId),
        or(like(relays.purpose, "send:%"), like(relays.purpose, "refund:%")),
        sql`${relays.draft}->'calls'->0->>'argsJson' like '%"receiver_id":"' || ${accounts.accountId} || '"%'`,
      ),
    )
    .orderBy(desc(relays.createdAt))
    .limit(limit)
  return rows.flatMap(({ relay, from }) => {
    const call = (relay.draft as DelegateDraft).calls[0]
    if (call?.method !== "ft_transfer") return []
    const args = JSON.parse(call.argsJson) as { amount: string }
    return [
      {
        id: relay.id,
        network: relay.network,
        from: from ?? relay.senderId,
        refund: relay.purpose.startsWith("refund:"),
        amount: BigInt(args.amount),
        createdAt: relay.createdAt,
      },
    ]
  })
}

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
