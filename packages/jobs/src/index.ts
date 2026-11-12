import { PgBoss } from "pg-boss"
import { z } from "zod"

/**
 * Every background queue and the payload it carries (validated on both sides).
 * Jobs that move money are never retried by the queue: each handler is written so that
 * running it again picks up where it stopped, and a sweep at start re-queues unfinished work.
 */
export const QUEUES = {
  /** Send one signed gas-free action through the operator. */
  relaySend: {
    name: "relay-send",
    payload: z.object({ relayId: z.uuid() }),
    options: { retryLimit: 0, expireInSeconds: 180 },
  },
  /**
   * Check a wallet payment on NEAR until its transaction is final, then settle it. Reading is safe to repeat, so a
   * transaction NEAR doesn't know yet is retried with backoff.
   */
  paymentVerify: {
    name: "payment-verify",
    payload: z.object({ paymentId: z.uuid() }),
    options: { retryLimit: 20, retryDelay: 3, retryBackoff: true, expireInSeconds: 120 },
  },
  /** Create a user's NEAR account and register it on USDC. Safe to repeat. */
  accountSetup: {
    name: "account-setup",
    payload: z.object({ accountRowId: z.uuid() }),
    options: { retryLimit: 3, retryDelay: 5, retryBackoff: true, expireInSeconds: 180 },
  },
} as const

export type QueueKey = keyof typeof QUEUES
export type Payload<K extends QueueKey> = z.infer<(typeof QUEUES)[K]["payload"]>

/** Start pg-boss and create every queue with its options. */
export async function startBoss(url: string): Promise<PgBoss> {
  const boss = new PgBoss(url)
  boss.on("error", (error) => console.error("[pg-boss]", error))
  await boss.start()
  for (const queue of Object.values(QUEUES)) {
    await boss.createQueue(queue.name, queue.options)
  }
  return boss
}

/** A client that can only queue jobs: no workers, no maintenance. For the web app. */
export async function connectBoss(url: string): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: url, supervise: false, schedule: false })
  boss.on("error", (error) => console.error("[pg-boss]", error))
  await boss.start()
  return boss
}

/**
 * Send a job after validating its payload. `key` makes the job unique while it is queued or
 * running, so the same work is never queued twice.
 */
export async function enqueue<K extends QueueKey>(
  boss: PgBoss,
  queue: K,
  payload: Payload<K>,
  key?: string,
) {
  const definition = QUEUES[queue]
  return boss.send(
    definition.name,
    definition.payload.parse(payload) as object,
    key ? { singletonKey: key } : {},
  )
}

export type { PgBoss }
