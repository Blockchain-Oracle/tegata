import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { createdAt, id, updatedAt } from "./columns.ts"
import { network, workspaces } from "./identity.ts"

/**
 * An API key (plan 6.8 Y). Only a SHA-256 hash of the secret is stored; the person sees it once. `prefix` is the
 * first characters, kept so the list can say which key is which.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    name: text().notNull(),
    prefix: text().notNull(),
    hash: text().notNull(),
    lastUsedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("api_keys_hash_idx").on(table.hash),
    index("api_keys_workspace_idx").on(table.workspaceId, table.network),
  ],
)

/** Something that happened that a developer can be told about: stored once, delivered to every endpoint. */
export const events = pgTable(
  "events",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    /** `checkout.session.completed`, `payment.succeeded`, `payment.refunded`, `invoice.paid`. */
    type: text().notNull(),
    /** The object the event is about, as the API shows it. */
    data: jsonb().notNull(),
    /** Makes an event happen once: e.g. `payment.succeeded:<payment id>`. */
    dedupe: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("events_dedupe_idx").on(table.dedupe),
    index("events_workspace_idx").on(table.workspaceId, table.network, table.createdAt),
  ],
)

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    url: text().notNull(),
    /** Standard Webhooks signing secret, `whsec_<base64>`. Kept on the server to sign; shown to the owner on Reveal. */
    secret: text().notNull(),
    /** Event types it gets; empty means all. */
    eventTypes: jsonb().$type<string[]>().notNull().default([]),
    enabled: boolean().notNull().default(true),
    /** Set for Tegata's own test inbox, so its page can show what arrived. */
    inboxToken: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("webhook_endpoints_workspace_idx").on(table.workspaceId, table.network),
    uniqueIndex("webhook_endpoints_inbox_idx").on(table.inboxToken),
  ],
)

export const deliveryStatus = pgEnum("delivery_status", ["pending", "delivered", "failed"])

/** One event to one endpoint, with every attempt's outcome. Retried with backoff; `failed` after the last try. */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: id(),
    endpointId: uuid()
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    eventId: uuid()
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    status: deliveryStatus().notNull().default("pending"),
    attempts: integer().notNull().default(0),
    lastStatus: integer(),
    lastError: text(),
    deliveredAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("webhook_deliveries_pair_idx").on(table.endpointId, table.eventId),
    index("webhook_deliveries_status_idx").on(table.status),
  ],
)

/** What Tegata's test inbox received: the headers, the body, and whether the signature checked out. */
export const webhookInbox = pgTable(
  "webhook_inbox",
  {
    id: id(),
    endpointId: uuid()
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    webhookId: text(),
    type: text(),
    verified: boolean().notNull(),
    body: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("webhook_inbox_endpoint_idx").on(table.endpointId, table.createdAt)],
)
