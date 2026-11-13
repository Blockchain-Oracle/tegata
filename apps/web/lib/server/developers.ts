// The Developers page's data, shaped for the screen: keys (never the secret), endpoints (secret hidden), deliveries,
// and what the test inbox received.

import type { NetworkId } from "@tegata/config"
import { serverEnv } from "@tegata/env"
import { enqueue } from "@tegata/jobs"
import { developerState, getSession, sessionObject } from "@tegata/services"

import type { DevelopersView } from "@/lib/client/types"

import { boss, db } from "./context.ts"

export async function developersView(
  workspaceId: string,
  network: NetworkId,
): Promise<DevelopersView> {
  const { keys, endpoints, deliveries, inbox } = await developerState(db(), workspaceId, network)
  return {
    appUrl: serverEnv().APP_URL,
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    })),
    endpoints: endpoints.map((e) => ({
      id: e.id,
      url: e.url,
      inbox: Boolean(e.inboxToken),
      enabled: e.enabled,
      secretHint: `${e.secret.slice(0, 10)}…`,
      createdAt: e.createdAt.toISOString(),
    })),
    deliveries: deliveries.map(({ delivery, event }) => ({
      id: delivery.id,
      endpointId: delivery.endpointId,
      eventId: event.id,
      type: event.type,
      status: delivery.status,
      attempts: delivery.attempts,
      lastStatus: delivery.lastStatus,
      lastError: delivery.lastError,
      createdAt: delivery.createdAt.toISOString(),
      payload: JSON.stringify(
        {
          id: event.id,
          type: event.type,
          created_at: event.createdAt.toISOString(),
          data: event.data,
        },
        null,
        2,
      ),
    })),
    inbox: inbox.map((m) => ({
      id: m.id,
      type: m.type,
      verified: m.verified,
      webhookId: m.webhookId,
      receivedAt: m.createdAt.toISOString(),
    })),
  }
}

export async function sessionView(workspaceId: string, id: string) {
  const session = await getSession(db(), workspaceId, id)
  return session ? sessionObject(db(), session, serverEnv().APP_URL) : null
}

/** Send these deliveries now, not at the next sweep. */
export async function sendNow(ids: { id: string }[]) {
  const queue = await boss()
  for (const { id } of ids)
    await enqueue(queue, "webhookDeliver", { deliveryId: id }, `${id}:now:${Date.now()}`)
}
