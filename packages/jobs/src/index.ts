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
  /** Sandbox: send a person today's test dollars from the operator. Never retried by the queue; the sweep at
   * start checks a grant whose transfer was already signed. */
  testDollars: {
    name: "test-dollars",
    payload: z.object({ grantId: z.uuid() }),
    options: { retryLimit: 0, expireInSeconds: 180 },
  },
  /** Email an invoice when it is sent, or a reminder (days from the due date). Reminders wait with `startAfter`. */
  invoiceEmail: {
    name: "invoice-email",
    payload: z.object({
      invoiceId: z.uuid(),
      kind: z.enum(["invoice", "reminder"]),
      offset: z.number().int().optional(),
    }),
    options: { retryLimit: 3, retryDelay: 30, retryBackoff: true, expireInSeconds: 120 },
  },
  /** Every few minutes: issue the repeating invoices that are due. */
  invoiceRepeat: {
    name: "invoice-repeat",
    payload: z.object({}),
    options: { retryLimit: 0, expireInSeconds: 300 },
  },
  /** Every five minutes: qualify referrals and pay the ones past their hold (idempotent). */
  referralSweep: {
    name: "referral-sweep",
    payload: z.object({}),
    options: { retryLimit: 0, expireInSeconds: 300 },
  },
  /** Register a person's NEAR account on USDC (paid by Tegata) so payroll can pay it. Safe to repeat. */
  destinationRegister: {
    name: "destination-register",
    payload: z.object({ destinationId: z.uuid() }),
    options: { retryLimit: 3, retryDelay: 5, retryBackoff: true, expireInSeconds: 180 },
  },
  /** Email a settled payment: "you got paid" to the business, the receipt to the payer. Only when email is on. */
  paymentEmail: {
    name: "payment-email",
    payload: z.object({ paymentId: z.uuid() }),
    options: { retryLimit: 3, retryDelay: 30, retryBackoff: true, expireInSeconds: 120 },
  },
  /** Email a person: added to payroll, or paid (with the payslip link). Only when email is on. */
  payrollEmail: {
    name: "payroll-email",
    payload: z.object({ kind: z.enum(["invite", "paid"]), id: z.uuid() }),
    options: { retryLimit: 3, retryDelay: 30, retryBackoff: true, expireInSeconds: 120 },
  },
  /** A withdrawal to a bank whose USDC reached the operator: hand Noah's test USDC to Noah (Sandbox hop). */
  bankHop: {
    name: "bank-hop",
    payload: z.object({ payoutId: z.uuid() }),
    options: { retryLimit: 0, expireInSeconds: 180 },
  },
  /** Follow a withdrawal at Noah until the bank is paid (re-queued every few seconds while it moves). */
  bankPoll: {
    name: "bank-poll",
    payload: z.object({ payoutId: z.uuid() }),
    options: { retryLimit: 2, retryDelay: 10, expireInSeconds: 60 },
  },
  /** Every minute: move stuck withdrawals on, and credit bank deposits Noah delivered. */
  bankSweep: {
    name: "bank-sweep",
    payload: z.object({}),
    options: { retryLimit: 0, expireInSeconds: 120 },
  },
  /** A card's money reached Tegata's card reserve on NEAR: issue the card, or raise it, at Bitnob. */
  cardFund: {
    name: "card-fund",
    payload: z.object({ moveId: z.uuid() }),
    options: { retryLimit: 2, retryDelay: 15, expireInSeconds: 120 },
  },
  /** A card payment (Transak): read the order and move the payment on; re-sent every few seconds until it ends. */
  cardPayPoll: {
    name: "card-pay-poll",
    payload: z.object({ paymentId: z.uuid() }),
    options: { retryLimit: 2, retryDelay: 10, expireInSeconds: 90 },
  },
  /** Every minute: card payments no job is following (a worker restart, a lost job). */
  cardPaySweep: {
    name: "card-pay-sweep",
    payload: z.object({}),
    options: { retryLimit: 0, expireInSeconds: 120 },
  },
  /** End a card for good: move what's left on it back, then the issuer ends it. */
  cardRemove: {
    name: "card-remove",
    payload: z.object({ cardId: z.uuid(), network: z.enum(["testnet", "mainnet"]) }),
    options: { retryLimit: 2, retryDelay: 15, expireInSeconds: 180 },
  },
  /** Every minute: card fills that landed on NEAR but weren't passed to the issuer yet. */
  cardSweep: {
    name: "card-sweep",
    payload: z.object({}),
    options: { retryLimit: 0, expireInSeconds: 120 },
  },
  /** Every morning: ask owners whose payday has come to approve the run (one email per payday). */
  payrollDue: {
    name: "payroll-due",
    payload: z.object({}),
    options: { retryLimit: 0, expireInSeconds: 300 },
  },
  /** The 1st of each month: last month's statement to each business that had movements. */
  statementMonthly: {
    name: "statement-monthly",
    payload: z.object({}),
    options: { retryLimit: 0, expireInSeconds: 600 },
  },
  /** Register a business on the autopilot contract (the operator pays its storage). Safe to repeat. */
  autopilotRegister: {
    name: "autopilot-register",
    payload: z.object({ autopilotId: z.uuid() }),
    options: { retryLimit: 3, retryDelay: 5, retryBackoff: true, expireInSeconds: 180 },
  },
  /** Every minute: call `run` on autopilot plans whose payday has come, and record each run from its events. */
  autopilotKeeper: {
    name: "autopilot-keeper",
    payload: z.object({}),
    options: { retryLimit: 0, expireInSeconds: 600 },
  },
  /** Send one webhook delivery. Retries are scheduled by the handler itself (30 s, 2 min, 10 min, 1 h, 6 h). */
  webhookDeliver: {
    name: "webhook-deliver",
    payload: z.object({ deliveryId: z.uuid() }),
    options: { retryLimit: 0, expireInSeconds: 60 },
  },
  /** Every minute: queue webhook deliveries that are new or due for their next try. */
  webhookSweep: {
    name: "webhook-sweep",
    payload: z.object({}),
    options: { retryLimit: 0, expireInSeconds: 120 },
  },
  /** A Live pay-in: read 1Click once and move the payment on; re-queued every few seconds until it's final. */
  oneclickPoll: {
    name: "oneclick-poll",
    payload: z.object({ paymentId: z.uuid() }),
    options: { retryLimit: 0, expireInSeconds: 60 },
  },
  /** Every minute: make sure every open Live pay-in has a poll queued (after a restart, say). */
  oneclickSweep: {
    name: "oneclick-sweep",
    payload: z.object({}),
    options: { retryLimit: 0, expireInSeconds: 120 },
  },
  /** A payout to another chain on its way: read 1Click once; re-queued until delivered or refunded. */
  payoutPoll: {
    name: "payout-poll",
    payload: z.object({ payoutId: z.uuid() }),
    options: { retryLimit: 0, expireInSeconds: 60 },
  },
  /** Every minute: a poll for every payout still on its way. */
  payoutSweep: {
    name: "payout-sweep",
    payload: z.object({}),
    options: { retryLimit: 0, expireInSeconds: 120 },
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
  when?: { startAfter: Date },
) {
  const definition = QUEUES[queue]
  return boss.send(definition.name, definition.payload.parse(payload) as object, {
    ...(key ? { singletonKey: key } : {}),
    ...(when ? { startAfter: when.startAfter } : {}),
  })
}

export type { PgBoss }
