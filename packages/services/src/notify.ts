// The email outbox (schema/notifications.ts). `queueEmail` is called inside the same transaction as the event it tells
// about, so an email can't be forgotten and a rolled-back event sends nothing. The worker drains the outbox: it claims
// due rows (skip-locked, so two workers never send the same row), checks the owner's preferences, sends, and retries
// with backoff. A row's id is Resend's idempotency key.

import { type Db, schema } from "@tegata/db"
import type { EmailEvent, EmailKind } from "@tegata/documents"
import { and, eq, inArray, lte, sql } from "drizzle-orm"

import type { Conn } from "./events.ts"

const { notifications, workspaces, users } = schema

const MAX_ATTEMPTS = 6
/** 30 s, 2 min, 8 min, 30 min, 2 h. */
const backoffMs = (attempt: number) => 30_000 * 4 ** Math.max(0, attempt - 1)
/** A row stuck in "sending" (a worker died mid-send) is retried after this. */
const STALE_SENDING_MS = 5 * 60_000

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Queue one email. Safe to repeat: the dedupe key makes a second queue of the same thing a no-op. */
export async function queueEmail(
  conn: Conn,
  input: {
    event: EmailEvent
    to: string | null | undefined
    dedupe: string
    workspaceId?: string | null
  },
) {
  const to = input.to?.trim()
  if (!to || !EMAIL.test(to)) return
  await conn
    .insert(notifications)
    .values({
      kind: input.event.kind,
      to,
      workspaceId: input.workspaceId ?? null,
      data: input.event.data,
      dedupe: input.dedupe,
    })
    .onConflictDoNothing({ target: notifications.dedupe })
}

/** Where a business's notices go: its email, or its owner's sign-in email. Null for a wallet owner with neither. */
export async function ownerAddress(conn: Conn, workspaceId: string) {
  const [row] = await conn
    .select({ business: workspaces.email, owner: users.email })
    .from(workspaces)
    .innerJoin(users, eq(users.id, workspaces.ownerId))
    .where(eq(workspaces.id, workspaceId))
  return row?.business ?? row?.owner ?? null
}

export type QueuedEmail = typeof notifications.$inferSelect

/** Claim up to `limit` due emails for sending. */
export async function claimEmails(db: Db, limit = 10): Promise<QueuedEmail[]> {
  const stale = new Date(Date.now() - STALE_SENDING_MS)
  return db
    .update(notifications)
    .set({ status: "sending", attempts: sql`${notifications.attempts} + 1` })
    .where(
      inArray(
        notifications.id,
        sql`(select ${notifications.id} from ${notifications}
             where (${notifications.status} = 'queued' and ${notifications.nextAttemptAt} <= now())
                or (${notifications.status} = 'sending' and ${notifications.updatedAt} < ${stale.toISOString()})
             order by ${notifications.createdAt}
             limit ${limit}
             for update skip locked)`,
      ),
    )
    .returning()
}

/** False when the owner switched this kind off (Business → Emails). Kinds without a switch always go. */
export async function wanted(db: Db, email: QueuedEmail): Promise<boolean> {
  if (!email.workspaceId) return true
  const [row] = await db
    .select({ prefs: workspaces.emailPrefs })
    .from(workspaces)
    .where(eq(workspaces.id, email.workspaceId))
  return row?.prefs?.[email.kind] !== false
}

export async function markEmail(
  db: Db,
  id: string,
  result:
    | { status: "sent"; providerId: string }
    | { status: "skipped"; reason: string }
    | { status: "retry"; error: string; attempts: number },
) {
  if (result.status === "sent") {
    await db
      .update(notifications)
      .set({ status: "sent", providerId: result.providerId, sentAt: new Date(), error: null })
      .where(eq(notifications.id, id))
  } else if (result.status === "skipped") {
    await db
      .update(notifications)
      .set({ status: "skipped", error: result.reason })
      .where(eq(notifications.id, id))
  } else {
    const last = result.attempts >= MAX_ATTEMPTS
    await db
      .update(notifications)
      .set({
        status: last ? "failed" : "queued",
        error: result.error.slice(0, 500),
        nextAttemptAt: new Date(Date.now() + backoffMs(result.attempts)),
      })
      .where(eq(notifications.id, id))
  }
}

/** Emails that gave up, for a business's own history (and the invoice timeline's "email failed"). */
export function failedEmails(db: Db, workspaceId: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.workspaceId, workspaceId), eq(notifications.status, "failed")))
}

/** The owner's email switches, as Business → Emails shows them. */
export async function emailPrefs(db: Db, workspaceId: string) {
  const [row] = await db
    .select({ prefs: workspaces.emailPrefs })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
  return row?.prefs ?? {}
}

export async function setEmailPref(db: Db, workspaceId: string, kind: EmailKind, on: boolean) {
  await db
    .update(workspaces)
    .set({ emailPrefs: sql`${workspaces.emailPrefs} || ${JSON.stringify({ [kind]: on })}::jsonb` })
    .where(eq(workspaces.id, workspaceId))
}

/** Queued emails older than a minute (the worker's drain is every few seconds; this is for a health check). */
export async function emailBacklog(db: Db) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.status, "queued"),
        lte(notifications.createdAt, new Date(Date.now() - 60_000)),
      ),
    )
  return row?.count ?? 0
}

/** The last emails a business sent or queued (Business → Emails). */
export function recentEmails(db: Db, workspaceId: string, limit = 12) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.workspaceId, workspaceId))
    .orderBy(sql`${notifications.createdAt} desc`)
    .limit(limit)
}
