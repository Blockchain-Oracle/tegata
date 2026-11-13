// Events (plan 6.8 Y): what happened, stored once and queued for every webhook endpoint that wants it. Kept apart from
// developers.ts so payment settlement can raise events without importing the whole developer service.
import type { NetworkId } from "@tegata/config"
import { formatUsd } from "@tegata/core/money"
import { type Db, schema } from "@tegata/db"
import { and, eq } from "drizzle-orm"

const { events, webhookEndpoints, webhookDeliveries, payments } = schema

/** A database handle or an open transaction. */
export type Conn = Db | Parameters<Parameters<Db["transaction"]>[0]>[0]

export const EVENT_TYPES = [
  "checkout.session.completed",
  "payment.succeeded",
  "payment.refunded",
  "invoice.paid",
] as const
export type EventType = (typeof EVENT_TYPES)[number] | "ping"

export function paymentObject(payment: typeof payments.$inferSelect) {
  return {
    id: payment.id,
    object: "payment",
    amount: formatUsd(payment.amount),
    amount_units: payment.amount.toString(),
    refunded_units: payment.refunded.toString(),
    currency: "usd",
    rail: payment.rail,
    payer: payment.payer,
    network: `near-${payment.network}`,
    tx_hash: payment.txHash,
    request_id: payment.requestId,
    settled_at: payment.settledAt?.toISOString() ?? null,
  }
}

/** Store an event once (by `dedupe`) and queue a delivery to every enabled endpoint that wants it. */
export async function emitEvent(
  db: Conn,
  input: {
    workspaceId: string
    network: NetworkId
    type: EventType
    data: unknown
    dedupe: string
    endpointId?: string
  },
) {
  const [event] = await db
    .insert(events)
    .values({
      workspaceId: input.workspaceId,
      network: input.network,
      type: input.type,
      data: input.data,
      dedupe: input.dedupe,
    })
    .onConflictDoNothing()
    .returning()
  if (!event) return []
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.workspaceId, input.workspaceId),
        eq(webhookEndpoints.network, input.network),
        eq(webhookEndpoints.enabled, true),
        ...(input.endpointId ? [eq(webhookEndpoints.id, input.endpointId)] : []),
      ),
    )
  const wanted = endpoints.filter(
    (e) => input.type === "ping" || !e.eventTypes.length || e.eventTypes.includes(input.type),
  )
  if (!wanted.length) return []
  return db
    .insert(webhookDeliveries)
    .values(wanted.map((endpoint) => ({ endpointId: endpoint.id, eventId: event.id })))
    .onConflictDoNothing()
    .returning({ id: webhookDeliveries.id })
}
