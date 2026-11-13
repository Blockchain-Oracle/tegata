// Developers: API keys (only a hash is stored), checkout sessions created over the API, events, and
// webhooks signed with Standard Webhooks and retried with backoff. Tegata's own test inbox lets a webhook be seen end
// to end with no outside service.
import { createHash, randomBytes } from "node:crypto"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import type { NetworkId } from "@tegata/config"
import { formatUsd } from "@tegata/core/money"
import { type Db, schema } from "@tegata/db"
import { and, desc, eq, inArray, isNull } from "drizzle-orm"
import { Webhook } from "standardwebhooks"

import { paymentObject } from "./events.ts"
import { LINK_LIMITS, PaymentError, publicToken, type Tx } from "./payments.ts"

const {
  apiKeys,
  events,
  webhookEndpoints,
  webhookDeliveries,
  webhookInbox,
  requests,
  accounts,
  workspaces,
  payments,
} = schema

type Conn = Db | Tx

const SESSION_TOKEN_LENGTH = 14
const INBOX_TOKEN_LENGTH = 20
const KEY_BYTES = 24
const SECRET_BYTES = 24
const PREFIX_LENGTH = 12
/** Wait before each retry: 30 s, 2 min, 10 min, 1 h, 6 h. Six tries in all. */
export const WEBHOOK_BACKOFF_MS = [30_000, 120_000, 600_000, 3_600_000, 21_600_000] as const
const WEBHOOK_TIMEOUT_MS = 10_000
const MAX_URL = 500
const MAX_ENDPOINTS = 5

export { EVENT_TYPES, type EventType, emitEvent, paymentObject } from "./events.ts"

export class DeveloperError extends Error {
  constructor(
    readonly code: "unauthorized" | "not_found" | "bad_input" | "limit",
    message: string,
  ) {
    super(message)
  }
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")

// --- API keys ---------------------------------------------------------------------------------------------------

/** A new key: the full secret is returned once; only its hash and prefix are kept. */
export async function createApiKey(
  db: Db,
  input: { workspaceId: string; network: NetworkId; name: string },
) {
  const name = input.name.trim().slice(0, 60) || "API key"
  const key = `tk_${input.network === "mainnet" ? "live" : "test"}_${randomBytes(KEY_BYTES).toString("base64url")}`
  const [row] = await db
    .insert(apiKeys)
    .values({
      workspaceId: input.workspaceId,
      network: input.network,
      name,
      prefix: key.slice(0, PREFIX_LENGTH),
      hash: sha256(key),
    })
    .returning()
  if (!row) throw new Error("Could not create the key")
  return { key, row }
}

export function listApiKeys(db: Db, workspaceId: string, network: NetworkId) {
  return db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.workspaceId, workspaceId),
        eq(apiKeys.network, network),
        isNull(apiKeys.revokedAt),
      ),
    )
    .orderBy(desc(apiKeys.createdAt))
}

export async function revokeApiKey(db: Db, workspaceId: string, id: string) {
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, workspaceId)))
}

/** The key behind `Authorization: Bearer tk_…`, with its business and the owner's account on its network. */
export async function authenticate(db: Db, header: string | null) {
  const key = header?.match(/^Bearer\s+(tk_(?:test|live)_[A-Za-z0-9_-]+)$/)?.[1]
  if (!key)
    throw new DeveloperError("unauthorized", "Send your API key as Authorization: Bearer tk_…")
  const [row] = await db
    .select({ key: apiKeys, workspace: workspaces })
    .from(apiKeys)
    .innerJoin(workspaces, eq(workspaces.id, apiKeys.workspaceId))
    .where(and(eq(apiKeys.hash, sha256(key)), isNull(apiKeys.revokedAt)))
  if (!row) throw new DeveloperError("unauthorized", "That API key isn't valid, or was revoked")
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.key.id))
  return row
}

// --- checkout sessions ------------------------------------------------------------------------------------------

export interface SessionInput {
  /** USDC base units. */
  amount: bigint
  description: string
  successUrl: string | null
  metadata: Record<string, string> | null
  idempotencyKey: string | null
}

const httpsUrl = (value: string | null) => {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error()
    return url.toString().slice(0, MAX_URL)
  } catch {
    throw new DeveloperError("bad_input", "success_url must be an https URL")
  }
}

/** A one-time request, paid on Tegata's pay page. A repeated Idempotency-Key returns the same session. */
export async function createSession(
  db: Db,
  input: SessionInput & {
    apiKeyId: string | null
    workspaceId: string
    ownerId: string
    network: NetworkId
    source?: string
  },
) {
  if (input.amount < LINK_LIMITS.minUnits || input.amount > LINK_LIMITS.maxUnits)
    throw new DeveloperError("bad_input", "amount must be between 0.01 and 1000000")
  if (input.metadata && Object.keys(input.metadata).length > 20)
    throw new DeveloperError("bad_input", "metadata holds at most 20 keys")
  if (input.apiKeyId && input.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.apiKeyId, input.apiKeyId),
          eq(requests.idempotencyKey, input.idempotencyKey),
        ),
      )
    if (existing) return existing
  }
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, input.ownerId), eq(accounts.network, input.network)))
  if (!account?.readyAt)
    throw new PaymentError("not_ready", "The business's account is still being set up")
  const [row] = await db
    .insert(requests)
    .values({
      workspaceId: input.workspaceId,
      network: input.network,
      kind: "session",
      token: publicToken(SESSION_TOKEN_LENGTH),
      title: input.description.trim().slice(0, LINK_LIMITS.title) || "Checkout",
      amount: input.amount,
      reusable: false,
      receiverId: account.accountId,
      successUrl: httpsUrl(input.successUrl),
      metadata: input.metadata ?? (input.source ? { source: input.source } : null),
      apiKeyId: input.apiKeyId,
      idempotencyKey: input.idempotencyKey,
    })
    .returning()
  if (!row) throw new Error("Could not create the session")
  return row
}

export async function getSession(db: Db, workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(requests)
    .where(
      and(eq(requests.id, id), eq(requests.workspaceId, workspaceId), eq(requests.kind, "session")),
    )
  return row ?? null
}

/** The session as the API returns it (and as webhook payloads carry it). */
export async function sessionObject(
  db: Conn,
  request: typeof requests.$inferSelect,
  appUrl: string,
) {
  const [paid] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.requestId, request.id), eq(payments.status, "succeeded")))
    .limit(1)
  return {
    id: request.id,
    object: "checkout.session",
    status:
      request.status === "paid" ? "complete" : request.status === "closed" ? "expired" : "open",
    url: `${appUrl}/pay/${request.token}`,
    amount: formatUsd(request.amount ?? 0n),
    amount_units: (request.amount ?? 0n).toString(),
    currency: "usd",
    settlement: { asset: "USDC", network: `near-${request.network}`, account: request.receiverId },
    description: request.title,
    success_url: request.successUrl,
    metadata: request.metadata ?? {},
    payment: paid ? paymentObject(paid) : null,
    created_at: request.createdAt.toISOString(),
  }
}

// --- events and webhooks ----------------------------------------------------------------------------------------

/** Deliveries waiting to be sent (the worker sweeps these). */
export function pendingDeliveries(db: Db) {
  return db
    .select({
      id: webhookDeliveries.id,
      attempts: webhookDeliveries.attempts,
      updatedAt: webhookDeliveries.updatedAt,
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.status, "pending"))
}

const PRIVATE_V4 = [
  [0x0a000000, 8],
  [0x7f000000, 8],
  [0xa9fe0000, 16],
  [0xac100000, 12],
  [0xc0a80000, 16],
  [0x64400000, 10],
  [0x00000000, 8],
] as const

function privateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase()
    if (a.startsWith("::ffff:")) return privateAddress(a.slice(7))
    return (
      a === "::1" || a === "::" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80")
    )
  }
  const n = address.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
  return PRIVATE_V4.some(([base, bits]) => n >>> (32 - bits) === base >>> (32 - bits))
}

/** An endpoint must be https and must not resolve into a private network (no requests into the server's own). */
export async function checkEndpointUrl(value: string, allowLocal: boolean) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new DeveloperError("bad_input", "That isn't a URL")
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  if (allowLocal && local) return url
  if (url.protocol !== "https:")
    throw new DeveloperError("bad_input", "Webhook URLs must start with https://")
  const found = await lookup(url.hostname, { all: true }).catch(() => [])
  if (!found.length) throw new DeveloperError("bad_input", `${url.hostname} doesn't resolve`)
  if (found.some((a) => privateAddress(a.address)))
    throw new DeveloperError("bad_input", "That URL points into a private network")
  return url
}

export async function createEndpoint(
  db: Db,
  input: {
    workspaceId: string
    network: NetworkId
    url?: string
    inbox?: boolean
    appUrl: string
    allowLocal: boolean
  },
) {
  const existing = await db
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.workspaceId, input.workspaceId),
        eq(webhookEndpoints.network, input.network),
      ),
    )
  if (existing.length >= MAX_ENDPOINTS)
    throw new DeveloperError("limit", `Up to ${MAX_ENDPOINTS} endpoints`)
  const inboxToken = input.inbox ? publicToken(INBOX_TOKEN_LENGTH) : null
  const url = inboxToken
    ? `${input.appUrl}/api/webhooks/inbox/${inboxToken}`
    : (input.url?.trim() ?? "")
  if (!inboxToken) await checkEndpointUrl(url, input.allowLocal)
  if (url.length > MAX_URL) throw new DeveloperError("bad_input", "That URL is too long")
  const [row] = await db
    .insert(webhookEndpoints)
    .values({
      workspaceId: input.workspaceId,
      network: input.network,
      url,
      secret: `whsec_${randomBytes(SECRET_BYTES).toString("base64")}`,
      inboxToken,
    })
    .returning()
  if (!row) throw new Error("Could not add the endpoint")
  return row
}

export async function ownEndpoint(db: Db, workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.workspaceId, workspaceId)))
  if (!row) throw new DeveloperError("not_found", "No such endpoint")
  return row
}

export type DeliveryResult = { status: "delivered" | "retry" | "failed"; retryInMs?: number }

/**
 * Worker: send one delivery with Standard Webhooks headers. A 2xx delivers it; anything else counts an attempt and
 * schedules the next one, until the sixth fails it for good.
 */
export async function deliver(
  db: Db,
  deliveryId: string,
  allowLocal: boolean,
): Promise<DeliveryResult | null> {
  const [row] = await db
    .select({ delivery: webhookDeliveries, endpoint: webhookEndpoints, event: events })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .innerJoin(events, eq(events.id, webhookDeliveries.eventId))
    .where(eq(webhookDeliveries.id, deliveryId))
  if (row?.delivery.status !== "pending") return null
  const body = JSON.stringify({
    id: row.event.id,
    type: row.event.type,
    created_at: row.event.createdAt.toISOString(),
    data: row.event.data,
  })
  const msgId = `msg_${row.delivery.id}`
  const at = new Date()
  let status: number | null = null
  let error: string | null = null
  try {
    if (!row.endpoint.inboxToken) await checkEndpointUrl(row.endpoint.url, allowLocal)
    const signature = new Webhook(row.endpoint.secret).sign(msgId, at, body)
    const response = await fetch(row.endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Tegata-Webhooks/1",
        "webhook-id": msgId,
        "webhook-timestamp": String(Math.floor(at.getTime() / 1000)),
        "webhook-signature": signature,
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    })
    status = response.status
  } catch (cause) {
    error = cause instanceof Error ? cause.message.slice(0, 300) : "Request failed"
  }
  const attempts = row.delivery.attempts + 1
  const ok = status !== null && status >= 200 && status < 300
  const last = attempts > WEBHOOK_BACKOFF_MS.length
  await db
    .update(webhookDeliveries)
    .set({
      attempts,
      lastStatus: status,
      lastError: ok ? null : (error ?? `HTTP ${status}`),
      status: ok ? "delivered" : last ? "failed" : "pending",
      deliveredAt: ok ? new Date() : null,
    })
    .where(eq(webhookDeliveries.id, row.delivery.id))
  if (ok) return { status: "delivered" }
  if (last) return { status: "failed" }
  return { status: "retry", retryInMs: WEBHOOK_BACKOFF_MS[attempts - 1] }
}

/** Send a delivery again from the start (the owner's Resend). */
export async function resendDelivery(db: Db, workspaceId: string, deliveryId: string) {
  const [row] = await db
    .select({ delivery: webhookDeliveries, endpoint: webhookEndpoints })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookEndpoints.workspaceId, workspaceId)))
  if (!row) throw new DeveloperError("not_found", "No such delivery")
  await db
    .update(webhookDeliveries)
    .set({ status: "pending", attempts: 0, lastError: null, lastStatus: null })
    .where(eq(webhookDeliveries.id, deliveryId))
  return row.delivery.id
}

/** Tegata's test inbox: record what arrived, and whether its signature checks out with the endpoint's secret. */
export async function receiveAtInbox(
  db: Db,
  token: string,
  body: string,
  headers: Record<string, string>,
) {
  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.inboxToken, token))
  if (!endpoint) throw new DeveloperError("not_found", "No such inbox")
  let verified = false
  let type: string | null = null
  try {
    const payload = new Webhook(endpoint.secret).verify(body, headers) as { type?: string }
    verified = true
    type = payload.type ?? null
  } catch {
    try {
      type = (JSON.parse(body) as { type?: string }).type ?? null
    } catch {
      type = null
    }
  }
  await db.insert(webhookInbox).values({
    endpointId: endpoint.id,
    webhookId: headers["webhook-id"] ?? null,
    type,
    verified,
    body: body.slice(0, 20_000),
  })
  return verified
}

/** Everything the Developers page shows. */
export async function developerState(db: Db, workspaceId: string, network: NetworkId) {
  const [keys, endpoints] = await Promise.all([
    listApiKeys(db, workspaceId, network),
    db
      .select()
      .from(webhookEndpoints)
      .where(
        and(eq(webhookEndpoints.workspaceId, workspaceId), eq(webhookEndpoints.network, network)),
      )
      .orderBy(desc(webhookEndpoints.createdAt)),
  ])
  const ids = endpoints.map((e) => e.id)
  const [deliveries, inbox] = ids.length
    ? await Promise.all([
        db
          .select({ delivery: webhookDeliveries, event: events })
          .from(webhookDeliveries)
          .innerJoin(events, eq(events.id, webhookDeliveries.eventId))
          .where(inArray(webhookDeliveries.endpointId, ids))
          .orderBy(desc(webhookDeliveries.createdAt))
          .limit(30),
        db
          .select()
          .from(webhookInbox)
          .where(inArray(webhookInbox.endpointId, ids))
          .orderBy(desc(webhookInbox.createdAt))
          .limit(10),
      ])
    : [[], []]
  return { keys, endpoints, deliveries, inbox }
}

export async function listEvents(db: Db, workspaceId: string, network: NetworkId, limit = 20) {
  return db
    .select()
    .from(events)
    .where(and(eq(events.workspaceId, workspaceId), eq(events.network, network)))
    .orderBy(desc(events.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100))
}
