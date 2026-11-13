// The autopilot (plan 6.8 T, section 2): a business's payroll schedule paid by Tegata's contract on NEAR with nobody
// online. Turning it on is two gas-free actions signed together (set money aside, create the plan); the operator only
// registers the business (paying its storage). The keeper calls `run` when a payday's time has passed, and each run is
// recorded from the contract's own events as an ordinary payroll run with payslips.
import { AUTOPILOT, NETWORKS, type NetworkId } from "@tegata/config"
import { atLocal, RUN_HOUR } from "@tegata/core/invoices"
import {
  type AutopilotAction,
  type AutopilotEvent,
  autopilotBusiness,
  autopilotCreatePlan,
  autopilotDeposit,
  autopilotPlan,
  autopilotPlanAction,
  autopilotRegister,
  autopilotRun,
  autopilotWithdraw,
  type DelegateDraft,
  type Operator,
  readAutopilotEvents,
  usdcBalance,
} from "@tegata/core/near"
import { nextPayday, payPeriod } from "@tegata/core/payroll"
import { type Db, schema } from "@tegata/db"
import { and, desc, eq, inArray } from "drizzle-orm"

import { listPeople, nextPaydayFor, PayrollError } from "./payroll.ts"
import { type Approval, approvalMatches, createRelayDraft, submitRelaySignature } from "./relays.ts"

const { autopilotPlans, accounts, relays, payRuns, payRows } = schema

type AutopilotRow = typeof autopilotPlans.$inferSelect
const LIVE = ["preparing", "ready", "approved", "on"] as const
/** A payday whose 09:00 is closer than this can't be the first date: the contract needs dates in the future. */
const FIRST_DATE_MARGIN_MS = 10 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The business's autopilot that is being set up or is on, if any. */
export async function currentAutopilot(db: Db, workspaceId: string, network: NetworkId) {
  const [row] = await db
    .select()
    .from(autopilotPlans)
    .where(
      and(
        eq(autopilotPlans.workspaceId, workspaceId),
        eq(autopilotPlans.network, network),
        inArray(autopilotPlans.status, [...LIVE]),
      ),
    )
    .orderBy(desc(autopilotPlans.createdAt))
    .limit(1)
  return row ?? null
}

function localDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number]
  return { year, month, day }
}

/** The paydays the autopilot would pay (`count` of them, from the next one), each due at 09:00 local. */
export async function autopilotPreview(
  db: Db,
  input: { workspaceId: string; network: NetworkId; timezone: string; count: number },
) {
  const next = await nextPaydayFor(db, input.workspaceId, input.network)
  if (!next) throw new PayrollError("not_ready", "Set a payday first")
  const paydays: string[] = []
  const dueMs: number[] = []
  let day = next.payday
  const earliest = Date.now() + FIRST_DATE_MARGIN_MS
  for (let i = 0; paydays.length < input.count && i < input.count + 2; i++) {
    const at = atLocal(localDate(day), RUN_HOUR, input.timezone).getTime()
    if (at > earliest) {
      paydays.push(day)
      dueMs.push(at)
    }
    day = nextPayday(next.schedule.cadence, day, next.schedule.anchorDay)
  }
  const team = await listPeople(db, input.workspaceId, input.network)
  const rows = team.flatMap((m) =>
    m.ready.state === "ready"
      ? [
          {
            personId: m.person.id,
            name: m.person.name,
            role: m.person.role,
            destinationKind: m.ready.kind,
            accountId: m.ready.accountId,
            amount: m.person.amount.toString(),
          },
        ]
      : [],
  )
  const left = team
    .filter((m) => m.ready.state !== "ready")
    .map((m) => ({
      name: m.person.name,
      reason:
        m.ready.state === "none"
          ? "Hasn't chosen where pay lands"
          : "Their account is still getting ready",
    }))
  const total = rows.reduce((sum, r) => sum + BigInt(r.amount), 0n)
  return { cadence: next.schedule.cadence, paydays, dueMs, rows, left, total }
}

/** Start turning the autopilot on: snapshot the rows and paydays. The route queues the operator's registration. */
export async function prepareAutopilot(
  db: Db,
  input: {
    workspaceId: string
    ownerId: string
    network: NetworkId
    timezone: string
    count: number
    setAside: bigint
  },
) {
  if (await currentAutopilot(db, input.workspaceId, input.network))
    throw new PayrollError("wrong_state", "Autopilot is already on or being set up")
  if (!(AUTOPILOT.dateChoices as readonly number[]).includes(input.count))
    throw new PayrollError("bad_input", "Choose 3, 6 or 12 paydays")
  const [owner] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, input.ownerId), eq(accounts.network, input.network)))
  if (!owner?.readyAt) throw new PayrollError("not_ready", "Your account is still being set up")
  const preview = await autopilotPreview(db, input)
  if (!preview.rows.length) throw new PayrollError("not_ready", "Nobody is ready to be paid yet")
  if (preview.rows.length > AUTOPILOT.maxRows)
    throw new PayrollError("limit", "Autopilot pays up to 100 people")
  if (preview.paydays.length < input.count)
    throw new PayrollError("not_ready", "Not enough paydays ahead")
  const most = preview.total * BigInt(preview.paydays.length)
  if (input.setAside < preview.total || input.setAside > most)
    throw new PayrollError("bad_input", "Set aside at least one payday, and at most all of them")
  const registered = Boolean(await autopilotBusiness(input.network, owner.accountId))
  const [row] = await db
    .insert(autopilotPlans)
    .values({
      workspaceId: input.workspaceId,
      network: input.network,
      status: registered ? "ready" : "preparing",
      senderId: owner.accountId,
      paydays: preview.paydays,
      dueMs: preview.dueMs,
      rows: preview.rows,
      total: preview.total,
      setAside: input.setAside,
    })
    .returning()
  if (!row) throw new Error("Could not start the autopilot")
  return row
}

/** Worker: register the business on the contract (operator pays its storage), then it's ready to sign. */
export async function registerForAutopilot(db: Db, operator: Operator, autopilotId: string) {
  const [row] = await db.select().from(autopilotPlans).where(eq(autopilotPlans.id, autopilotId))
  if (row?.status !== "preparing") return row
  if (!(await autopilotBusiness(operator.network, row.senderId))) {
    const result = await operator.call(NETWORKS[operator.network].autopilot, [
      autopilotRegister(row.senderId),
    ])
    if (result.status !== "success") {
      await db
        .update(autopilotPlans)
        .set({
          status: "failed",
          error: result.error ?? "Couldn't register on the autopilot contract",
        })
        .where(eq(autopilotPlans.id, row.id))
      return row
    }
    await db
      .update(autopilotPlans)
      .set({ registerTx: result.hash })
      .where(eq(autopilotPlans.id, row.id))
  }
  const [ready] = await db
    .update(autopilotPlans)
    .set({ status: "ready" })
    .where(and(eq(autopilotPlans.id, row.id), eq(autopilotPlans.status, "preparing")))
    .returning()
  return ready
}

async function ownAutopilot(db: Db, workspaceId: string, id: string) {
  if (!UUID.test(id)) throw new PayrollError("not_found", "No such autopilot")
  const [row] = await db
    .select()
    .from(autopilotPlans)
    .where(and(eq(autopilotPlans.id, id), eq(autopilotPlans.workspaceId, workspaceId)))
  if (!row) throw new PayrollError("not_found", "No such autopilot")
  return row
}

const contractRows = (row: AutopilotRow) =>
  row.rows.map((r) => ({ account_id: r.accountId, amount: r.amount }))

/** The two actions to sign together: set the money aside (USDC), then create the plan (the contract). */
export async function draftAutopilot(
  db: Db,
  input: { workspaceId: string; userId: string; publicKey: string; id: string },
) {
  const row = await ownAutopilot(db, input.workspaceId, input.id)
  if (row.status !== "ready")
    throw new PayrollError("wrong_state", "Autopilot isn't ready to sign yet")
  if ((row.dueMs[0] ?? 0) <= Date.now() + FIRST_DATE_MARGIN_MS / 2)
    throw new PayrollError(
      "wrong_state",
      "The first payday is too close now. Set autopilot up again.",
    )
  if ((await usdcBalance(row.network, row.senderId)) < row.setAside)
    throw new PayrollError("bad_input", "Not enough dollars in your balance to set that aside")
  const net = NETWORKS[row.network]
  const deposit = await createRelayDraft(db, {
    userId: input.userId,
    network: row.network,
    purpose: `autopilot:${row.id}:deposit`,
    senderId: row.senderId,
    receiverId: net.usdc,
    publicKey: input.publicKey,
    calls: [autopilotDeposit(row.network, row.setAside)],
    nonceOffset: 1,
  })
  const plan = await createRelayDraft(db, {
    userId: input.userId,
    network: row.network,
    purpose: `autopilot:${row.id}:plan`,
    senderId: row.senderId,
    receiverId: net.autopilot,
    publicKey: input.publicKey,
    calls: [autopilotCreatePlan(contractRows(row), row.dueMs)],
    nonceOffset: 2,
  })
  await db
    .update(autopilotPlans)
    .set({ depositRelayId: deposit.relayId, planRelayId: plan.relayId })
    .where(eq(autopilotPlans.id, row.id))
  return { deposit, plan, autopilot: row.id }
}

/** Both signatures are checked before either is stored; then the worker relays them in order. */
export async function approveAutopilot(
  db: Db,
  input: {
    workspaceId: string
    userId: string
    id: string
    signatures: Approval[]
  },
) {
  const row = await ownAutopilot(db, input.workspaceId, input.id)
  if (row.status !== "ready") throw new PayrollError("wrong_state", "Autopilot isn't ready to sign")
  const order = [row.depositRelayId, row.planRelayId]
  const given = new Map(input.signatures.map((s) => [s.relayId, s]))
  if (order.some((id) => !id || !given.has(id)) || given.size !== 2)
    throw new PayrollError("wrong_state", "Autopilot changed. Set it up again.")
  const drafts = await db
    .select()
    .from(relays)
    .where(inArray(relays.id, order as string[]))
  for (const relay of drafts) {
    const approval = given.get(relay.id)
    if (
      relay.userId !== input.userId ||
      !approval ||
      !approvalMatches(relay.draft as DelegateDraft, approval)
    )
      throw new PayrollError("forbidden", "A signature doesn't match")
  }
  for (const relayId of order as string[]) {
    const approval = given.get(relayId)
    if (approval) await submitRelaySignature(db, { ...approval, userId: input.userId })
  }
  await db.update(autopilotPlans).set({ status: "approved" }).where(eq(autopilotPlans.id, row.id))
  return order as string[]
}

/** Worker, after an `autopilot:` relay is final: once the plan exists on NEAR, record its id and it's on. */
export async function settleAutopilotRelay(db: Db, relayId: string) {
  const [relay] = await db.select().from(relays).where(eq(relays.id, relayId))
  const [, id, step] = relay?.purpose.split(":") ?? []
  if (!relay || !id || step !== "plan") return "ignored"
  const [row] = await db.select().from(autopilotPlans).where(eq(autopilotPlans.id, id))
  if (row?.status !== "approved") return "ignored"
  if (relay.status === "failed" || relay.status === "expired") {
    await db
      .update(autopilotPlans)
      .set({ status: "failed", error: relay.error ?? "NEAR didn't accept the plan" })
      .where(eq(autopilotPlans.id, id))
    return "failed"
  }
  if (relay.status !== "success") return "pending"
  const business = await autopilotBusiness(row.network, row.senderId)
  const taken = await db
    .select({ planId: autopilotPlans.planId })
    .from(autopilotPlans)
    .where(eq(autopilotPlans.senderId, row.senderId))
  const known = new Set(taken.map((t) => t.planId))
  const planId = [...(business?.plans ?? [])].reverse().find((p) => !known.has(p))
  if (!planId) return "pending"
  await db
    .update(autopilotPlans)
    .set({ status: "on", planId, error: null })
    .where(eq(autopilotPlans.id, id))
  return "on"
}

/** Pause, resume, turn off, withdraw or add money: one gas-free action for the owner to sign. */
export async function draftAutopilotAction(
  db: Db,
  input: {
    workspaceId: string
    userId: string
    publicKey: string
    id: string
    action: "pause" | "resume" | "off" | "withdraw" | "add"
    amount?: bigint
  },
) {
  const row = await ownAutopilot(db, input.workspaceId, input.id)
  const net = NETWORKS[row.network]
  const purpose = `autopilot:${row.id}:${input.action}:${crypto.randomUUID()}`
  const base = {
    userId: input.userId,
    network: row.network,
    purpose,
    senderId: row.senderId,
    publicKey: input.publicKey,
  }
  if (input.action === "add" || input.action === "withdraw") {
    const amount = input.amount ?? 0n
    if (amount <= 0n) throw new PayrollError("bad_input", "Enter an amount above zero")
    if (input.action === "add") {
      if ((await usdcBalance(row.network, row.senderId)) < amount)
        throw new PayrollError("bad_input", "Not enough dollars in your balance")
      return createRelayDraft(db, {
        ...base,
        receiverId: net.usdc,
        calls: [autopilotDeposit(row.network, amount)],
      })
    }
    return createRelayDraft(db, {
      ...base,
      receiverId: net.autopilot,
      calls: [autopilotWithdraw(amount)],
    })
  }
  if (!row.planId) throw new PayrollError("wrong_state", "Autopilot isn't on yet")
  const method: AutopilotAction =
    input.action === "pause"
      ? "pause_plan"
      : input.action === "resume"
        ? "resume_plan"
        : "cancel_plan"
  return createRelayDraft(db, {
    ...base,
    receiverId: net.autopilot,
    calls: [autopilotPlanAction(method, row.planId)],
  })
}

/** Worker, after an action relay lands: turning it off ends this autopilot row. */
export async function settleAutopilotAction(db: Db, relayId: string) {
  const [relay] = await db.select().from(relays).where(eq(relays.id, relayId))
  const [, id, step] = relay?.purpose.split(":") ?? []
  if (relay?.status !== "success" || step !== "off" || !id) return
  await db.update(autopilotPlans).set({ status: "off" }).where(eq(autopilotPlans.id, id))
}

/** What the Payroll page shows: this row, and the contract's own numbers for it. */
export async function autopilotState(db: Db, workspaceId: string, network: NetworkId) {
  const row = await currentAutopilot(db, workspaceId, network)
  const [owner] = row
    ? [row.senderId]
    : (
        await db
          .select({ accountId: accounts.accountId })
          .from(accounts)
          .innerJoin(schema.workspaces, eq(schema.workspaces.ownerId, accounts.userId))
          .where(and(eq(schema.workspaces.id, workspaceId), eq(accounts.network, network)))
      ).map((a) => a.accountId)
  const [business, plan] = await Promise.all([
    owner ? autopilotBusiness(network, owner) : Promise.resolve(null),
    row?.planId ? autopilotPlan(network, row.planId) : Promise.resolve(null),
  ])
  const [latest] = await db
    .select({ id: autopilotPlans.id })
    .from(autopilotPlans)
    .where(and(eq(autopilotPlans.workspaceId, workspaceId), eq(autopilotPlans.network, network)))
    .orderBy(desc(autopilotPlans.createdAt))
    .limit(1)
  return { row, business: business ?? null, plan: plan ?? null, lastId: latest?.id ?? null }
}

/** True when the autopilot pays this payday, so a manual run for it is refused (never paid twice). */
export async function autopilotPays(
  db: Db,
  workspaceId: string,
  network: NetworkId,
  payday: string,
) {
  const row = await currentAutopilot(db, workspaceId, network)
  return Boolean(row && row.status !== "preparing" && row.paydays.includes(payday))
}

// --- the keeper ------------------------------------------------------------------------------------------------------

/**
 * Every minute: for each autopilot that's on, read its plan from NEAR; when a payday's time has passed, call `run`
 * (as many chunks as it takes) and record what the contract did from its events.
 */
export async function runAutopilots(db: Db, operator: Operator) {
  const rows = await db
    .select()
    .from(autopilotPlans)
    .where(and(eq(autopilotPlans.network, operator.network), eq(autopilotPlans.status, "on")))
  const done: string[] = []
  for (const row of rows) {
    if (!row.planId) continue
    for (let chunk = 0; chunk < AUTOPILOT.maxRows / 10 + 1; chunk++) {
      const plan = await autopilotPlan(operator.network, row.planId)
      if (plan?.status !== "Active") break
      const due = Number(plan.due[plan.next] ?? Number.POSITIVE_INFINITY)
      if (due > Date.now()) break
      const result = await operator.call(NETWORKS[operator.network].autopilot, [
        autopilotRun(row.planId),
      ])
      if (result.status !== "success") break
      const events =
        (await readAutopilotEvents(operator.network, result.hash, operator.accountId)) ?? []
      await recordRun(db, row, plan.next, result.hash, events)
      done.push(`${row.planId}:${plan.next}`)
      if (events.some((e) => e.event === "run_underfunded")) break
    }
  }
  return done
}

/** Turn one `run` call's events into the run, its rows and their payslips. */
async function recordRun(
  db: Db,
  row: AutopilotRow,
  occurrence: number,
  txHash: string,
  events: AutopilotEvent[],
) {
  const payday = row.paydays[occurrence]
  if (!payday) return
  const underfunded = events.find((e) => e.event === "run_underfunded")
  if (underfunded) {
    await db
      .update(autopilotPlans)
      .set({
        underfunded: {
          payday,
          needed: String(underfunded.data.needed ?? "0"),
          available: String(underfunded.data.available ?? "0"),
          at: new Date().toISOString(),
        },
      })
      .where(eq(autopilotPlans.id, row.id))
    return
  }
  const workspaceId = row.workspaceId
  const [schedule] = await db
    .select({ cadence: schema.payrolls.cadence })
    .from(schema.payrolls)
    .where(
      and(eq(schema.payrolls.workspaceId, workspaceId), eq(schema.payrolls.network, row.network)),
    )
  const period = payPeriod(schedule?.cadence ?? "monthly", payday)
  await db.transaction(async (tx) => {
    // A manual draft for this payday gives way: the autopilot has paid it.
    await tx
      .delete(payRuns)
      .where(
        and(
          eq(payRuns.workspaceId, workspaceId),
          eq(payRuns.network, row.network),
          eq(payRuns.payday, payday),
          inArray(payRuns.status, ["draft", "failed"]),
          eq(payRuns.source, "approval"),
        ),
      )
    await tx
      .insert(payRuns)
      .values({
        workspaceId,
        network: row.network,
        payday,
        periodFrom: period.from,
        periodTo: period.to,
        status: "approved",
        source: "autopilot",
        autopilotId: row.id,
        senderId: NETWORKS[row.network].autopilot,
        total: row.total,
        approvedAt: new Date(),
      })
      .onConflictDoNothing()
    const [run] = await tx
      .select()
      .from(payRuns)
      .where(
        and(
          eq(payRuns.workspaceId, workspaceId),
          eq(payRuns.network, row.network),
          eq(payRuns.payday, payday),
        ),
      )
    if (run?.source !== "autopilot") return
    for (const event of events) {
      if (event.event !== "payout_paid" && event.event !== "payout_failed") continue
      const index = Number(event.data.row)
      const snapshot = row.rows[index]
      if (!snapshot) continue
      const paid = event.event === "payout_paid"
      await tx
        .insert(payRows)
        .values({
          runId: run.id,
          personId: snapshot.personId,
          name: snapshot.name,
          role: snapshot.role,
          destinationKind: snapshot.destinationKind,
          accountId: snapshot.accountId,
          amount: BigInt(snapshot.amount),
          status: paid ? "paid" : "failed",
          skipReason: paid ? null : "Couldn't be paid; returned to autopilot",
          batch: Math.floor(index / 10) + 1,
          txHash,
          paidAt: paid ? new Date() : null,
        })
        .onConflictDoNothing()
    }
    const recorded = await tx.select().from(payRows).where(eq(payRows.runId, run.id))
    const finished = recorded.length >= row.rows.length
    const hashes = [...new Set([...run.txHashes, txHash])]
    await tx
      .update(payRuns)
      .set({
        txHashes: hashes,
        ...(finished
          ? recorded.some((r) => r.status === "failed")
            ? {
                status: "failed" as const,
                error: "Some rows were returned to autopilot",
                paidAt: new Date(),
              }
            : { status: "paid" as const, paidAt: new Date() }
          : {}),
      })
      .where(eq(payRuns.id, run.id))
  })
  await db.update(autopilotPlans).set({ underfunded: null }).where(eq(autopilotPlans.id, row.id))
}

/** Rows waiting on the operator's registration (the worker sweeps these at start). */
export function autopilotsToRegister(db: Db) {
  return db
    .select({ id: autopilotPlans.id, network: autopilotPlans.network })
    .from(autopilotPlans)
    .where(eq(autopilotPlans.status, "preparing"))
}
