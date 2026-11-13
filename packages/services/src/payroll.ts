// Pay people: the team, where each person's pay lands, the schedule, and runs that pay everyone ready
// in all-or-nothing batches. A run is drafted from a snapshot, signed by the owner as one delegate action per 50
// people, relayed by the worker, and settled only from the USDC contract's own transfer events.
import { NETWORKS, type NetworkId } from "@tegata/config"
import { localToday } from "@tegata/core/invoices"
import {
  accountExists,
  type DelegateDraft,
  explorerTx,
  ftTransfer,
  isRegistered,
  matchingTransfer,
  type Operator,
  readUsdcTransfers,
} from "@tegata/core/near"
import { deliveryTxUrl, routeAsset } from "@tegata/core/oneclick"
import {
  anchorDayFor,
  batches,
  PAYROLL_LIMITS,
  type PayCadence,
  type PayLine,
  paydayAfter,
  payLinesProblem,
  payPeriod,
  periodLabel,
  rowBreakdown,
  rowTotal,
} from "@tegata/core/payroll"
import { type Db, type StoredPayLine, schema } from "@tegata/db"
import { and, asc, count, desc, eq, gt, inArray, lte, ne, sql } from "drizzle-orm"

import { businessLogo } from "./business.ts"
import { BUSINESS_HEADER, headerLogo, publicToken } from "./payments.ts"
import {
  failDraftedPayouts,
  markPayoutSent,
  PayoutError,
  quotePayout,
  registerDepositAddresses,
} from "./payouts.ts"
import { applySplitToAccount } from "./pots.ts"
import { type Approval, approvalMatches, createRelayDraft, submitRelaySignature } from "./relays.ts"

const {
  people,
  personDestinations,
  payrolls,
  payRuns,
  payRows,
  accounts,
  workspaces,
  relays,
  users,
  payouts,
} = schema

/** Where pay can land: a Tegata account, a NEAR account, or an address on another chain (Live). */
export type DestinationKind = "tegata" | "near" | "chain"

const PERSON_TOKEN_LENGTH = 14
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class PayrollError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "bad_input"
      | "duplicate"
      | "limit"
      | "wrong_state"
      | "not_ready"
      | "forbidden",
    message: string,
  ) {
    super(message)
  }
}

/** A row's one-off lines as stored (amounts as strings) and as the maths takes them (bigint). */
export const payLines = (stored: readonly StoredPayLine[] | null | undefined): PayLine[] =>
  (stored ?? []).map((line) => ({ ...line, amount: BigInt(line.amount) }))
const storeLines = (lines: readonly PayLine[]): StoredPayLine[] =>
  lines.map((line) => ({ kind: line.kind, label: line.label, amount: line.amount.toString() }))

/** A paid row's pay before its lines: the pay set for that run, else what the lines leave of the amount. */
export function rowBasePay(row: {
  amount: bigint
  basePay: bigint | null
  lines: StoredPayLine[]
}) {
  if (row.basePay !== null) return row.basePay
  return row.amount - rowTotal(0n, payLines(row.lines))
}

/** The memo that ties one payroll transfer to one row (and so to its payslip). */
export const payrollMemo = (rowId: string) => `tegata:payroll:${rowId}`

/** "mei@studio.example" → "m••@studio.example": enough for the person to recognise, not enough to harvest. */
export function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@")
  return `${name.slice(0, 1)}••@${domain}`
}

// --- people -------------------------------------------------------------------------------------------------

export interface PersonInput {
  name: string
  email?: string | null
  role?: string | null
  /** USDC base units per run. */
  amount: bigint
}

function cleanPerson(input: PersonInput) {
  const name = input.name.trim()
  const email = input.email?.trim().toLowerCase() || null
  const role = input.role?.trim() || null
  if (!name) throw new PayrollError("bad_input", "Add their name")
  if (name.length > PAYROLL_LIMITS.name)
    throw new PayrollError("bad_input", "That name is too long")
  if (email && (email.length > PAYROLL_LIMITS.email || !EMAIL.test(email)))
    throw new PayrollError("bad_input", "That isn't an email address")
  if (role && role.length > PAYROLL_LIMITS.role)
    throw new PayrollError("bad_input", "That role is too long")
  if (input.amount <= 0n) throw new PayrollError("bad_input", "Pay must be above zero")
  if (input.amount > PAYROLL_LIMITS.maxPay)
    throw new PayrollError("bad_input", "That pay is too large")
  return { name, email, role, amount: input.amount }
}

async function activeCount(db: Db, workspaceId: string, network: NetworkId) {
  const [row] = await db
    .select({ n: count() })
    .from(people)
    .where(
      and(
        eq(people.workspaceId, workspaceId),
        eq(people.network, network),
        eq(people.status, "active"),
      ),
    )
  return row?.n ?? 0
}

/**
 * Add one person, or bring back a removed one with the same email (their history stays theirs). Returns the person
 * and whether they're new, so the caller knows whether to send the invite.
 */
export async function addPerson(
  db: Db,
  workspaceId: string,
  network: NetworkId,
  input: PersonInput,
) {
  const person = cleanPerson(input)
  if ((await activeCount(db, workspaceId, network)) >= PAYROLL_LIMITS.people)
    throw new PayrollError("limit", `A team can have up to ${PAYROLL_LIMITS.people} people`)
  if (person.email) {
    const [existing] = await db
      .select()
      .from(people)
      .where(
        and(
          eq(people.workspaceId, workspaceId),
          eq(people.network, network),
          eq(people.email, person.email),
        ),
      )
    if (existing?.status === "active")
      throw new PayrollError("duplicate", `${existing.name} already has ${person.email}`)
    if (existing) {
      const [back] = await db
        .update(people)
        .set({ ...person, status: "active" })
        .where(eq(people.id, existing.id))
        .returning()
      if (!back) throw new PayrollError("not_found", "That person disappeared")
      return back
    }
  }
  const [created] = await db
    .insert(people)
    .values({ workspaceId, network, ...person, token: publicToken(PERSON_TOKEN_LENGTH) })
    .returning()
  if (!created) throw new Error("Could not add the person")
  return created
}

/** Add many people from a CSV; each row that can't be added comes back with its reason, the rest are saved. */
export async function importPeople(
  db: Db,
  workspaceId: string,
  network: NetworkId,
  rows: (PersonInput & { line: number })[],
) {
  const added: (typeof people.$inferSelect)[] = []
  const problems: { line: number; message: string }[] = []
  for (const row of rows) {
    try {
      added.push(await addPerson(db, workspaceId, network, row))
    } catch (error) {
      if (!(error instanceof PayrollError)) throw error
      problems.push({ line: row.line, message: error.message })
    }
  }
  return { added, problems }
}

async function ownPerson(db: Db, workspaceId: string, id: string) {
  if (!UUID.test(id)) throw new PayrollError("not_found", "No such person")
  const [row] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, id), eq(people.workspaceId, workspaceId)))
  if (!row) throw new PayrollError("not_found", "No such person")
  return row
}

export async function updatePerson(db: Db, workspaceId: string, id: string, input: PersonInput) {
  const current = await ownPerson(db, workspaceId, id)
  const person = cleanPerson(input)
  if (current.userId && person.email !== current.email)
    throw new PayrollError(
      "bad_input",
      "They've already signed in with their email, so it can't change",
    )
  try {
    const [updated] = await db.update(people).set(person).where(eq(people.id, id)).returning()
    return updated
  } catch {
    throw new PayrollError("duplicate", `Someone on your team already has ${person.email}`)
  }
}

export async function removePerson(db: Db, workspaceId: string, id: string) {
  await ownPerson(db, workspaceId, id)
  await db.update(people).set({ status: "removed" }).where(eq(people.id, id))
}

export async function markInvited(db: Db, id: string) {
  await db.update(people).set({ invitedAt: new Date() }).where(eq(people.id, id))
}

// --- where pay lands --------------------------------------------------------------------------------------------

type Destination = typeof personDestinations.$inferSelect

/** The destination a run uses now, and a newer one still waiting out its 24 hours. */
export function currentDestination(rows: readonly Destination[], now = new Date()) {
  const newest = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const active = newest.find((row) => row.activatesAt <= now) ?? null
  const pending = newest[0] && newest[0].activatesAt > now ? newest[0] : null
  return { active, pending }
}

export type Readiness =
  | { state: "ready"; kind: DestinationKind; accountId: string; route?: string | null }
  | { state: "opening"; kind: DestinationKind; accountId: string | null }
  | { state: "none" }

/** Whether a destination can be paid right now, and the NEAR account it pays. */
function readiness(
  destination: Destination | null,
  tegataAccount: { accountId: string; readyAt: Date | null } | undefined,
): Readiness {
  if (!destination) return { state: "none" }
  // Another chain: ready as soon as it's chosen (the address was checked then); paid through NEAR Intents in a run.
  if (destination.kind === "chain")
    return destination.accountId && destination.route
      ? {
          state: "ready",
          kind: "chain",
          accountId: destination.accountId,
          route: destination.route,
        }
      : { state: "none" }
  if (destination.kind === "near") {
    const accountId = destination.accountId ?? ""
    return destination.readyAt
      ? { state: "ready", kind: "near", accountId }
      : { state: "opening", kind: "near", accountId }
  }
  return tegataAccount?.readyAt
    ? { state: "ready", kind: "tegata", accountId: tegataAccount.accountId }
    : { state: "opening", kind: "tegata", accountId: tegataAccount?.accountId ?? null }
}

/** Every destination row for these people, grouped by person. */
async function destinationsFor(db: Db, personIds: string[]) {
  const map = new Map<string, Destination[]>()
  if (!personIds.length) return map
  const rows = await db
    .select()
    .from(personDestinations)
    .where(inArray(personDestinations.personId, personIds))
  for (const row of rows) map.set(row.personId, [...(map.get(row.personId) ?? []), row])
  return map
}

/** The Tegata accounts of these users on one network. */
async function tegataAccounts(db: Db, userIds: string[], network: NetworkId) {
  const map = new Map<string, { accountId: string; readyAt: Date | null }>()
  if (!userIds.length) return map
  const rows = await db
    .select({ userId: accounts.userId, accountId: accounts.accountId, readyAt: accounts.readyAt })
    .from(accounts)
    .where(and(inArray(accounts.userId, userIds), eq(accounts.network, network)))
  for (const row of rows) map.set(row.userId, row)
  return map
}

/** Can this NEAR account hold USDC on this network? (The route registers it through the worker when it can't yet.) */
export async function checkNearAccount(network: NetworkId, accountId: string) {
  if (!(await accountExists(network, accountId))) return { exists: false, registered: false }
  return {
    exists: true,
    registered: await isRegistered(network, NETWORKS[network].usdc, accountId),
  }
}

/**
 * Record where a person's pay lands. A person's change waits 24 hours once they already have one (Kawase's cooldown,
 * so a hijacked inbox can't redirect a payday unseen); their first choice, and one the owner sets, apply at once. A
 * newer choice replaces any change still waiting.
 */
async function setDestination(
  db: Db,
  input: {
    personId: string
    kind: DestinationKind
    accountId: string | null
    route?: string | null
    setBy: "person" | "owner"
    readyAt: Date | null
  },
) {
  const now = new Date()
  const rows = await db
    .select()
    .from(personDestinations)
    .where(eq(personDestinations.personId, input.personId))
  const { active } = currentDestination(rows, now)
  if (
    active &&
    active.kind === input.kind &&
    active.accountId === input.accountId &&
    (active.route ?? null) === (input.route ?? null)
  ) {
    await db
      .delete(personDestinations)
      .where(
        and(
          eq(personDestinations.personId, input.personId),
          gt(personDestinations.activatesAt, now),
        ),
      )
    return active
  }
  const waits = input.setBy === "person" && rows.length > 0
  const activatesAt = waits ? new Date(now.getTime() + PAYROLL_LIMITS.destinationCooldownMs) : now
  return db.transaction(async (tx) => {
    await tx
      .delete(personDestinations)
      .where(
        and(
          eq(personDestinations.personId, input.personId),
          gt(personDestinations.activatesAt, now),
        ),
      )
    const [row] = await tx
      .insert(personDestinations)
      .values({ ...input, activatesAt })
      .returning()
    if (!row) throw new Error("Could not save where pay lands")
    return row
  })
}

/** The owner points a person's pay at a NEAR account (for someone with no email, or who asked). */
export async function setDestinationByOwner(
  db: Db,
  workspaceId: string,
  personId: string,
  accountId: string,
) {
  const person = await ownPerson(db, workspaceId, personId)
  const check = await checkNearAccount(person.network, accountId)
  if (!check.exists) throw new PayrollError("bad_input", `${accountId} doesn't exist on NEAR`)
  return setDestination(db, {
    personId,
    kind: "near",
    accountId,
    setBy: "owner",
    readyAt: check.registered ? new Date() : null,
  })
}

/**
 * Pay to an address on another chain (Live only: NEAR Intents has no testnet). The route must be one 1Click lists; the
 * address is checked for the chain's format by the route that calls this.
 */
async function setChainDestination(
  db: Db,
  input: {
    personId: string
    network: NetworkId
    route: string
    address: string
    setBy: "person" | "owner"
  },
) {
  if (input.network !== "mainnet")
    throw new PayrollError(
      "not_ready",
      "Pay to another chain runs in Live: NEAR Intents has no testnet",
    )
  const address = input.address.trim()
  if (!address) throw new PayrollError("bad_input", "Enter the address")
  const asset = await routeAsset(input.route).catch(() => null)
  if (!asset) throw new PayrollError("bad_input", "That coin and chain isn't offered")
  return setDestination(db, {
    personId: input.personId,
    kind: "chain",
    accountId: address,
    route: input.route,
    setBy: input.setBy,
    readyAt: new Date(),
  })
}

/** The owner points a person's pay at an address on another chain (Live). */
export async function setChainDestinationByOwner(
  db: Db,
  workspaceId: string,
  personId: string,
  choice: { route: string; address: string },
) {
  const person = await ownPerson(db, workspaceId, personId)
  return setChainDestination(db, { personId, network: person.network, ...choice, setBy: "owner" })
}

async function personByToken(db: Db, token: string) {
  const [row] = await db
    .select({ person: people, ...BUSINESS_HEADER, ownerId: workspaces.ownerId })
    .from(people)
    .innerJoin(workspaces, eq(workspaces.id, people.workspaceId))
    .where(and(eq(people.token, token), eq(people.status, "active")))
  if (!row) throw new PayrollError("not_found", "This page has closed")
  return row
}

/** Only someone signed in with the invited email may choose; the first to do so is bound to the person for good. */
async function claim(db: Db, token: string, user: { id: string; email: string | null }) {
  const { person, business } = await personByToken(db, token)
  if (!person.email)
    throw new PayrollError("forbidden", `Ask ${business} to set where your pay lands`)
  if (person.userId && person.userId !== user.id)
    throw new PayrollError("forbidden", "Someone else already chose for this invite")
  if (user.email?.toLowerCase() !== person.email)
    throw new PayrollError(
      "forbidden",
      `Sign in with ${maskEmail(person.email)}, the email you were invited with`,
    )
  if (!person.userId)
    await db.update(people).set({ userId: user.id }).where(eq(people.id, person.id))
  return { ...person, userId: user.id }
}

/** The person chooses their Tegata account (it must be open on this network) or a NEAR account of their own. */
export async function chooseDestination(
  db: Db,
  token: string,
  user: { id: string; email: string | null },
  choice:
    | { kind: "tegata" }
    | { kind: "near"; accountId: string }
    | { kind: "chain"; route: string; address: string },
) {
  const person = await claim(db, token, user)
  if (choice.kind === "chain")
    return setChainDestination(db, {
      personId: person.id,
      network: person.network,
      ...choice,
      setBy: "person",
    })
  if (choice.kind === "tegata") {
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.network, person.network)))
    if (!account) throw new PayrollError("not_ready", "Open your Tegata account first")
    return setDestination(db, {
      personId: person.id,
      kind: "tegata",
      accountId: null,
      setBy: "person",
      readyAt: null,
    })
  }
  const check = await checkNearAccount(person.network, choice.accountId)
  if (!check.exists)
    throw new PayrollError("bad_input", `${choice.accountId} doesn't exist on NEAR`)
  return setDestination(db, {
    personId: person.id,
    kind: "near",
    accountId: choice.accountId,
    setBy: "person",
    readyAt: check.registered ? new Date() : null,
  })
}

/** Worker: register a person's NEAR account on USDC, paid by Tegata's operator, so it can receive pay. Repeatable. */
export async function registerDestination(db: Db, operator: Operator, destinationId: string) {
  const [row] = await db
    .select()
    .from(personDestinations)
    .where(eq(personDestinations.id, destinationId))
  if (!row || row.readyAt || row.kind !== "near" || !row.accountId) return row
  const accountId = row.accountId
  if (!(await accountExists(operator.network, accountId))) {
    await db
      .update(personDestinations)
      .set({ error: `${accountId} doesn't exist` })
      .where(eq(personDestinations.id, row.id))
    return row
  }
  let registeredTx: string | null = null
  if (!(await isRegistered(operator.network, NETWORKS[operator.network].usdc, accountId))) {
    const result = await operator.registerOnUsdc(accountId)
    if (result.status !== "success")
      throw new Error(`Registering ${accountId} failed: ${result.error ?? result.status}`)
    registeredTx = result.hash
  }
  const [ready] = await db
    .update(personDestinations)
    .set({ readyAt: new Date(), registeredTx, error: null })
    .where(eq(personDestinations.id, row.id))
    .returning()
  return ready
}

/** NEAR destinations still waiting for registration (the worker sweeps these at start). */
export function destinationsToRegister(db: Db) {
  return db
    .select({ id: personDestinations.id, network: people.network })
    .from(personDestinations)
    .innerJoin(people, eq(people.id, personDestinations.personId))
    .where(
      and(
        eq(personDestinations.kind, "near"),
        sql`${personDestinations.readyAt} is null`,
        sql`${personDestinations.error} is null`,
      ),
    )
}

// --- the team, as the business sees it ---------------------------------------------------------------------------

export interface TeamMember {
  person: typeof people.$inferSelect
  ready: Readiness
  pending: {
    kind: DestinationKind
    accountId: string | null
    route?: string | null
    activatesAt: Date
  } | null
  setBy: "person" | "owner" | null
}

export async function listPeople(
  db: Db,
  workspaceId: string,
  network: NetworkId,
): Promise<TeamMember[]> {
  const rows = await db
    .select()
    .from(people)
    .where(
      and(
        eq(people.workspaceId, workspaceId),
        eq(people.network, network),
        eq(people.status, "active"),
      ),
    )
    .orderBy(asc(people.name))
  const destinations = await destinationsFor(
    db,
    rows.map((row) => row.id),
  )
  const tegata = await tegataAccounts(
    db,
    rows.flatMap((row) => (row.userId ? [row.userId] : [])),
    network,
  )
  return rows.map((person) => {
    const { active, pending } = currentDestination(destinations.get(person.id) ?? [])
    const account = person.userId ? tegata.get(person.userId) : undefined
    return {
      person,
      ready: readiness(active, account),
      pending: pending && {
        kind: pending.kind,
        accountId: pending.accountId ?? account?.accountId ?? null,
        route: pending.route,
        activatesAt: pending.activatesAt,
      },
      setBy: active?.setBy ?? null,
    }
  })
}

export async function getPerson(db: Db, workspaceId: string, id: string) {
  const person = await ownPerson(db, workspaceId, id)
  const member = (await listPeople(db, workspaceId, person.network)).find((m) => m.person.id === id)
  const slips = await db
    .select({ row: payRows, run: payRuns })
    .from(payRows)
    .innerJoin(payRuns, eq(payRuns.id, payRows.runId))
    .where(and(eq(payRows.personId, id), eq(payRows.status, "paid")))
    .orderBy(desc(payRows.paidAt))
  return { member: member ?? null, person, slips }
}

// --- the schedule -------------------------------------------------------------------------------------------------

export async function getSchedule(db: Db, workspaceId: string, network: NetworkId) {
  const [row] = await db
    .select()
    .from(payrolls)
    .where(and(eq(payrolls.workspaceId, workspaceId), eq(payrolls.network, network)))
  return row ?? null
}

/** Set how often and the next payday (a date in the business's own time zone, today or later). */
export async function setSchedule(
  db: Db,
  input: {
    workspaceId: string
    network: NetworkId
    timezone: string
    cadence: PayCadence
    nextPayday: string
  },
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.nextPayday))
    throw new PayrollError("bad_input", "Pick a payday")
  if (input.nextPayday < localToday(input.timezone))
    throw new PayrollError("bad_input", "Pick today or a later day")
  const values = {
    cadence: input.cadence,
    firstPayday: input.nextPayday,
    anchorDay: anchorDayFor(input.nextPayday),
  }
  const [row] = await db
    .insert(payrolls)
    .values({ workspaceId: input.workspaceId, network: input.network, ...values })
    .onConflictDoUpdate({ target: [payrolls.workspaceId, payrolls.network], set: values })
    .returning()
  return row
}

/** The latest payday a run has been approved or paid for (so the next payday is the one after it). */
async function lastRunPayday(db: Db, workspaceId: string, network: NetworkId) {
  const [row] = await db
    .select({ payday: payRuns.payday })
    .from(payRuns)
    .where(
      and(
        eq(payRuns.workspaceId, workspaceId),
        eq(payRuns.network, network),
        inArray(payRuns.status, ["approved", "paid"]),
      ),
    )
    .orderBy(desc(payRuns.payday))
    .limit(1)
  return row?.payday ?? null
}

export async function nextPaydayFor(db: Db, workspaceId: string, network: NetworkId) {
  const schedule = await getSchedule(db, workspaceId, network)
  if (!schedule) return null
  const payday = paydayAfter(schedule, await lastRunPayday(db, workspaceId, network))
  return { schedule, payday, period: payPeriod(schedule.cadence, payday) }
}

// --- runs ----------------------------------------------------------------------------------------------------------

type RunRow = typeof payRows.$inferInsert

/**
 * Draft (or refresh) the run for the next payday: one row per person, each with the account it would pay right now.
 * Paid rows never change; a failed run comes back as a draft with a new attempt, so its batches get new relays.
 */
export async function draftRun(
  db: Db,
  input: { workspaceId: string; ownerId: string; network: NetworkId },
) {
  const next = await nextPaydayFor(db, input.workspaceId, input.network)
  if (!next) throw new PayrollError("not_ready", "Set a payday first")
  const [owner] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, input.ownerId), eq(accounts.network, input.network)))
  if (!owner?.readyAt) throw new PayrollError("not_ready", "Your account is still being set up")

  const team = await listPeople(db, input.workspaceId, input.network)
  return db.transaction(async (tx) => {
    await tx
      .insert(payRuns)
      .values({
        workspaceId: input.workspaceId,
        network: input.network,
        payday: next.payday,
        periodFrom: next.period.from,
        periodTo: next.period.to,
        senderId: owner.accountId,
      })
      .onConflictDoNothing()
    const [run] = await tx
      .select()
      .from(payRuns)
      .where(
        and(
          eq(payRuns.workspaceId, input.workspaceId),
          eq(payRuns.network, input.network),
          eq(payRuns.payday, next.payday),
        ),
      )
      .for("update")
    if (!run) throw new Error("Could not draft the run")
    if (run.status === "approved" || run.status === "paid") return run.id

    const existing = await tx.select().from(payRows).where(eq(payRows.runId, run.id))
    const byPerson = new Map(existing.map((row) => [row.personId, row]))
    const keep = new Set<string>()
    for (const { person, ready } of team) {
      keep.add(person.id)
      const before = byPerson.get(person.id)
      // Paid, or on its way to another chain: never drafted again.
      if (before?.status === "paid" || before?.status === "sending") continue
      // This run's edits survive a fresh draft: a pay set by hand stays, a usual pay follows the person, lines stay.
      const basePay = before?.basePay ?? null
      const lines = before?.lines ?? []
      const amount = rowTotal(basePay ?? person.amount, payLines(lines))
      const row: RunRow = {
        runId: run.id,
        personId: person.id,
        name: person.name,
        role: person.role,
        amount: amount > 0n ? amount : 0n,
        basePay,
        lines,
        destinationKind: ready.state === "none" ? null : ready.kind,
        accountId: ready.state === "ready" ? ready.accountId : null,
        route: ready.state === "ready" && ready.kind === "chain" ? (ready.route ?? null) : null,
        payoutId: null,
        status:
          ready.state !== "ready"
            ? "skipped"
            : before?.status === "excluded" ||
                payLinesProblem(basePay ?? person.amount, payLines(lines))
              ? "excluded"
              : "included",
        skipReason:
          ready.state === "none"
            ? person.email
              ? "Hasn't chosen where pay lands"
              : "No account yet: add a NEAR account for them"
            : ready.state === "opening"
              ? ready.kind === "tegata"
                ? "Their Tegata account is still opening"
                : `Getting ${ready.accountId} ready for dollars`
              : null,
        batch: null,
        relayId: null,
        txHash: null,
      }
      await tx
        .insert(payRows)
        .values(row)
        .onConflictDoUpdate({ target: [payRows.runId, payRows.personId], set: row })
    }
    const gone = existing.filter(
      (row) => !keep.has(row.personId) && row.status !== "paid" && row.status !== "sending",
    )
    if (gone.length)
      await tx.delete(payRows).where(
        inArray(
          payRows.id,
          gone.map((row) => row.id),
        ),
      )
    await tx
      .update(payRuns)
      .set({
        status: "draft",
        senderId: owner.accountId,
        error: null,
        attempt: run.status === "failed" ? run.attempt + 1 : run.attempt,
        total: await includedTotal(tx, run.id),
      })
      .where(eq(payRuns.id, run.id))
    return run.id
  })
}

type Conn = Db | Parameters<Parameters<Db["transaction"]>[0]>[0]

async function includedTotal(db: Conn, runId: string) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${payRows.amount}), 0)` })
    .from(payRows)
    .where(and(eq(payRows.runId, runId), eq(payRows.status, "included")))
  return BigInt(row?.total ?? "0")
}

async function ownRun(db: Conn, workspaceId: string, runId: string) {
  if (!UUID.test(runId)) throw new PayrollError("not_found", "No such run")
  const [run] = await db
    .select()
    .from(payRuns)
    .where(and(eq(payRuns.id, runId), eq(payRuns.workspaceId, workspaceId)))
  if (!run) throw new PayrollError("not_found", "No such run")
  return run
}

/** Leave someone out of this run, or put them back, while it's being reviewed. */
export async function setRowIncluded(
  db: Db,
  input: { workspaceId: string; runId: string; rowId: string; included: boolean },
) {
  const run = await ownRun(db, input.workspaceId, input.runId)
  if (run.status !== "draft")
    throw new PayrollError("wrong_state", "This run is already on its way")
  await db
    .update(payRows)
    .set({ status: input.included ? "included" : "excluded" })
    .where(
      and(
        eq(payRows.id, input.rowId),
        eq(payRows.runId, run.id),
        inArray(payRows.status, ["included", "excluded"]),
      ),
    )
  await db
    .update(payRuns)
    .set({ total: await includedTotal(db, run.id) })
    .where(eq(payRuns.id, run.id))
}

/**
 * This run's pay for one person and its one-off lines (bonus, reimbursement, deduction), while the run is a draft.
 * `pay` null means their usual pay. The row's amount becomes what is paid; the person's usual pay is unchanged.
 */
export async function setRowPay(
  db: Db,
  input: {
    workspaceId: string
    runId: string
    rowId: string
    pay: bigint | null
    lines: PayLine[]
  },
) {
  const run = await ownRun(db, input.workspaceId, input.runId)
  if (run.status !== "draft")
    throw new PayrollError("wrong_state", "This run is already on its way")
  const [found] = await db
    .select({ row: payRows, usual: people.amount })
    .from(payRows)
    .innerJoin(people, eq(people.id, payRows.personId))
    .where(and(eq(payRows.id, input.rowId), eq(payRows.runId, run.id)))
  if (!found) throw new PayrollError("not_found", "No such row")
  if (found.row.status !== "included" && found.row.status !== "excluded")
    throw new PayrollError("wrong_state", "Only people in this run can have their pay changed")
  const lines = input.lines.map((line) => ({ ...line, label: line.label.trim() }))
  const pay = input.pay ?? found.usual
  const problem = payLinesProblem(pay, lines)
  if (problem) throw new PayrollError("bad_input", problem)
  await db
    .update(payRows)
    .set({
      amount: rowTotal(pay, lines),
      // The usual pay typed back in is the usual pay: it follows the person again.
      basePay: input.pay === null || input.pay === found.usual ? null : input.pay,
      lines: storeLines(lines),
    })
    .where(eq(payRows.id, found.row.id))
  await db
    .update(payRuns)
    .set({ total: await includedTotal(db, run.id) })
    .where(eq(payRuns.id, run.id))
}

/**
 * Build the batches the owner signs: one delegate action of up to 50 `ft_transfer`s each, every transfer to the
 * row's account for its amount, with the row's memo. Nothing moves until every batch is signed.
 */
export async function prepareRun(
  db: Db,
  input: {
    workspaceId: string
    userId: string
    publicKey: string
    runId: string
    /** NEAR Intents' key, for rows paid to another chain. */
    oneClickKey?: string
  },
) {
  const run = await ownRun(db, input.workspaceId, input.runId)
  if (run.status !== "draft")
    throw new PayrollError("wrong_state", "This run is already on its way")
  const rows = await db
    .select()
    .from(payRows)
    .where(and(eq(payRows.runId, run.id), eq(payRows.status, "included")))
    .orderBy(asc(payRows.name), asc(payRows.id))
  if (!rows.length) throw new PayrollError("bad_input", "Nobody in this run is ready to be paid")
  const usdc = NETWORKS[run.network].usdc

  // Where each row's USDC goes. A NEAR account takes it with the row's memo; a row for another chain gets its own
  // signed NEAR Intents quote, and the batch sends its USDC to that quote's deposit address (which takes no memo).
  const targets = new Map<
    string,
    {
      to: string
      /** What the transfer sends: the pay, or for a stablecoin on another chain what its exact delivery costs. */
      amount: bigint
      memo: string | null
      via: { route: string; recipient: string; amountOut: string | null } | null
    }
  >()
  const payoutOf = new Map<string, string>()
  for (const row of rows) {
    if (row.destinationKind !== "chain") {
      targets.set(row.id, {
        to: row.accountId ?? "",
        amount: row.amount,
        memo: payrollMemo(row.id),
        via: null,
      })
      continue
    }
    if (run.network !== "mainnet" || !row.route || !row.accountId)
      throw new PayrollError(
        "bad_input",
        `${row.name} is paid on another chain, which runs in Live`,
      )
    const asset = await routeAsset(row.route).catch(() => null)
    if (!asset)
      throw new PayrollError("bad_input", `${row.name}'s coin and chain isn't offered right now`)
    let quoted: Awaited<ReturnType<typeof quotePayout>>
    try {
      quoted = await quotePayout(
        db,
        {
          workspaceId: input.workspaceId,
          userId: input.userId,
          senderId: run.senderId,
          kind: "payroll",
          amount: row.amount,
          destinationAsset: asset.assetId,
          symbol: asset.symbol,
          chain: asset.chain,
          recipient: row.accountId,
          stable: asset.stable,
          reference: row.id,
          // A stablecoin arrives as exactly the pay; another coin arrives as the pay's worth at the quoted rate.
          ...(asset.stable && asset.decimals !== null
            ? { exactOut: { decimals: asset.decimals } }
            : {}),
        },
        input.oneClickKey,
      )
    } catch (error) {
      throw new PayrollError(
        "bad_input",
        `${row.name}: ${error instanceof PayoutError ? error.message : "NEAR Intents can't price this right now"}`,
      )
    }
    await db.update(payRows).set({ payoutId: quoted.payout.id }).where(eq(payRows.id, row.id))
    payoutOf.set(row.id, quoted.payout.id)
    targets.set(row.id, {
      to: quoted.deposit,
      amount: quoted.payout.amount,
      memo: null,
      via: {
        route: row.route,
        recipient: row.accountId,
        amountOut: quoted.payout.amountOutFormatted,
      },
    })
  }

  const out: {
    relayId: string
    draft: DelegateDraft
    rows: {
      id: string
      accountId: string
      amount: string
      memo: string | null
      via: { route: string; recipient: string; amountOut: string | null } | null
    }[]
  }[] = []
  for (const [index, group] of batches(rows).entries()) {
    const batch = index + 1
    const { relayId, draft } = await createRelayDraft(db, {
      userId: input.userId,
      network: run.network,
      purpose: `run:${run.id}:${run.attempt}:${batch}`,
      senderId: run.senderId,
      receiverId: usdc,
      publicKey: input.publicKey,
      calls: group.map((row) => {
        const target = targets.get(row.id)
        return ftTransfer(target?.to ?? "", target?.amount ?? row.amount, target?.memo ?? undefined)
      }),
      nonceOffset: index + 1,
    })
    await db
      .update(payRows)
      .set({ batch, relayId })
      .where(
        inArray(
          payRows.id,
          group.map((row) => row.id),
        ),
      )
    const payoutIds = group.flatMap((row) => {
      const id = payoutOf.get(row.id)
      return id ? [id] : []
    })
    if (payoutIds.length)
      await db.update(payouts).set({ relayId }).where(inArray(payouts.id, payoutIds))
    out.push({
      relayId,
      draft,
      rows: group.map((row) => {
        const target = targets.get(row.id)
        return {
          id: row.id,
          accountId: target?.to ?? "",
          amount: (target?.amount ?? row.amount).toString(),
          memo: target?.memo ?? null,
          via: target?.via ?? null,
        }
      }),
    })
  }
  return { runId: run.id, total: run.total, batches: out }
}

/** Worker, before relaying a payroll batch: rows to another chain need their deposit addresses registered on USDC. */
export async function registerRunAddresses(db: Db, operator: Operator, relayId: string) {
  const [relay] = await db.select().from(relays).where(eq(relays.id, relayId))
  if (!relay?.purpose.startsWith("run:")) return
  const rows = await db
    .select({ payoutId: payRows.payoutId })
    .from(payRows)
    .where(and(eq(payRows.relayId, relayId), eq(payRows.status, "included")))
  await registerDepositAddresses(
    db,
    operator,
    rows.flatMap((row) => (row.payoutId ? [row.payoutId] : [])),
  )
}

/** Store every batch's signature (all checked before any is stored), then the run is on its way. */
export async function approveRun(
  db: Db,
  input: {
    workspaceId: string
    userId: string
    runId: string
    signatures: Approval[]
  },
) {
  const run = await ownRun(db, input.workspaceId, input.runId)
  if (run.status !== "draft")
    throw new PayrollError("wrong_state", "This run is already on its way")
  const rows = await db
    .select({ relayId: payRows.relayId })
    .from(payRows)
    .where(and(eq(payRows.runId, run.id), eq(payRows.status, "included")))
  const needed = new Set(rows.map((row) => row.relayId))
  const given = new Map(input.signatures.map((s) => [s.relayId, s]))
  if (
    needed.has(null) ||
    needed.size !== given.size ||
    [...needed].some((id) => !id || !given.has(id))
  )
    throw new PayrollError("wrong_state", "The run changed. Review it again.")

  const relayRows = await db
    .select()
    .from(relays)
    .where(inArray(relays.id, [...given.keys()]))
  for (const relay of relayRows) {
    const approval = given.get(relay.id)
    if (
      relay.userId !== input.userId ||
      !approval ||
      !approvalMatches(relay.draft as DelegateDraft, approval)
    )
      throw new PayrollError("forbidden", "A signature doesn't match this run")
  }
  for (const approval of given.values()) {
    await submitRelaySignature(db, { ...approval, userId: input.userId })
  }
  await db
    .update(payRuns)
    .set({ status: "approved", approvedAt: new Date() })
    .where(and(eq(payRuns.id, run.id), eq(payRuns.status, "draft")))
  return [...given.keys()]
}

export type RunSettle = "paid" | "failed" | "pending" | "ignored"

/**
 * Worker, after a `run:` relay is final: mark its rows paid only where the USDC contract's own event shows the
 * transfer (to the row's account, its amount, its memo), then close the run once every batch has landed.
 */
export async function settleRunRelay(
  db: Db,
  relayId: string,
  operatorId: string,
  oneClickKey?: string,
): Promise<RunSettle> {
  const [relay] = await db.select().from(relays).where(eq(relays.id, relayId))
  if (!relay?.purpose.startsWith("run:")) return "ignored"
  const rows = await db
    .select()
    .from(payRows)
    .where(and(eq(payRows.relayId, relayId), eq(payRows.status, "included")))
  const runId = relay.purpose.split(":")[1] ?? ""
  if (rows.length) {
    if (relay.status === "failed" || relay.status === "expired") {
      await db
        .update(payRows)
        .set({ status: "failed" })
        .where(and(eq(payRows.relayId, relayId), eq(payRows.status, "included")))
      await failDraftedPayouts(
        db,
        rows.flatMap((row) => (row.payoutId ? [row.payoutId] : [])),
        "The payroll batch didn't land. Nothing moved.",
      )
      await db
        .update(payRuns)
        .set({ error: relay.error ?? "NEAR didn't accept the batch. Nothing in it moved." })
        .where(eq(payRuns.id, runId))
    } else if (relay.status === "success" && relay.txHash) {
      // A relayed transaction is signed by the operator, so NEAR looks it up under the operator's account.
      const read = await readUsdcTransfers(relay.network, relay.txHash, operatorId)
      if (read.state === "pending") return "pending"
      const deposits = new Map(
        (
          await db
            .select({ id: payouts.id, depositAddress: payouts.depositAddress })
            .from(payouts)
            .where(
              inArray(
                payouts.id,
                rows
                  .flatMap((row) => (row.payoutId ? [row.payoutId] : []))
                  .concat(["00000000-0000-0000-0000-000000000000"]),
              ),
            )
        ).map((p) => [p.id, p.depositAddress]),
      )
      for (const row of rows) {
        // A row for another chain went to its NEAR Intents deposit address (no memo); the rest to their own account.
        const deposit = row.payoutId ? deposits.get(row.payoutId) : null
        const hit = row.payoutId
          ? deposit && read.transfers.find((t) => t.to === deposit && t.amount >= row.amount)
          : row.accountId &&
            matchingTransfer(read.transfers, {
              to: row.accountId,
              amount: row.amount,
              memo: payrollMemo(row.id),
            })
        if (hit && row.payoutId)
          await markPayoutSent(
            db,
            { payoutId: row.payoutId, txHash: relay.txHash, relayerId: operatorId },
            oneClickKey,
          )
        // A row for another chain is on its way, not paid: it's paid when NEAR Intents delivers it.
        await db
          .update(payRows)
          .set(
            !hit
              ? { status: "failed" }
              : row.payoutId
                ? { status: "sending", txHash: relay.txHash }
                : { status: "paid", txHash: relay.txHash, paidAt: new Date() },
          )
          .where(eq(payRows.id, row.id))
        // Pay that landed in a person's own Tegata account: their own split rule sets their share aside.
        if (hit && !row.payoutId && row.destinationKind === "tegata" && row.accountId)
          await applySplitToAccount(db, {
            accountId: row.accountId,
            network: relay.network,
            amount: row.amount,
            sourceType: "payslip",
            sourceId: row.id,
          })
      }
    } else {
      return "pending"
    }
  }
  return closeRun(db, runId)
}

/** Paid once no included row is left and none failed; failed once every batch is final and one didn't land. */
async function closeRun(db: Db, runId: string): Promise<RunSettle> {
  return db.transaction(async (tx) => {
    const [run] = await tx.select().from(payRuns).where(eq(payRuns.id, runId)).for("update")
    if (run?.status !== "approved") return "ignored"
    const rows = await tx.select().from(payRows).where(eq(payRows.runId, runId))
    if (rows.some((row) => row.status === "included" || row.status === "sending")) return "pending"
    const hashes = [...new Set(rows.flatMap((row) => (row.txHash ? [row.txHash] : [])))]
    const failed = rows.some((row) => row.status === "failed")
    await tx
      .update(payRuns)
      .set(
        failed
          ? { status: "failed", txHashes: hashes }
          : { status: "paid", txHashes: hashes, paidAt: new Date(), error: null },
      )
      .where(eq(payRuns.id, runId))
    return failed ? "failed" : "paid"
  })
}

/**
 * A payroll row's NEAR Intents payout reached the end: delivered, the row is paid (its payslip opens); refunded or
 * failed, the row failed (the USDC came back to the business) and the run can be retried for it. Then the run closes
 * if nothing else is on its way. Returns the run and how it stands, or null for a payout that isn't payroll.
 */
export async function settlePayrollPayout(db: Db, payoutId: string) {
  const [payout] = await db.select().from(payouts).where(eq(payouts.id, payoutId))
  if (payout?.kind !== "payroll" || !payout.reference) return null
  const [row] = await db.select().from(payRows).where(eq(payRows.id, payout.reference))
  if (!row) return null
  if (payout.status === "delivered")
    await db
      .update(payRows)
      .set({ status: "paid", paidAt: payout.deliveredAt ?? new Date() })
      .where(and(eq(payRows.id, row.id), eq(payRows.status, "sending")))
  else if (payout.status === "refunded" || payout.status === "failed") {
    const [failed] = await db
      .update(payRows)
      .set({ status: "failed" })
      .where(and(eq(payRows.id, row.id), eq(payRows.status, "sending")))
      .returning()
    if (failed)
      await db
        .update(payRuns)
        .set({
          error: `${row.name}'s pay couldn't be delivered on ${payout.chain}; the USDC came back to your balance.`,
        })
        .where(eq(payRuns.id, row.runId))
  } else return null
  return { runId: row.runId, settled: await closeRun(db, row.runId) }
}

/** Approved runs whose relays may have finished while no worker was watching (swept at start). */
export async function runRelaysToSettle(db: Db) {
  return db
    .selectDistinct({ relayId: payRows.relayId, network: payRuns.network })
    .from(payRows)
    .innerJoin(payRuns, eq(payRuns.id, payRows.runId))
    .where(and(eq(payRuns.status, "approved"), eq(payRows.status, "included")))
}

export async function listRuns(db: Db, workspaceId: string, network: NetworkId) {
  const runs = await db
    .select()
    .from(payRuns)
    .where(
      and(
        eq(payRuns.workspaceId, workspaceId),
        eq(payRuns.network, network),
        ne(payRuns.status, "draft"),
      ),
    )
    .orderBy(desc(payRuns.payday))
  const counts = runs.length
    ? await db
        .select({ runId: payRows.runId, n: count() })
        .from(payRows)
        .where(
          and(
            inArray(
              payRows.runId,
              runs.map((r) => r.id),
            ),
            inArray(payRows.status, ["paid", "included", "failed"]),
          ),
        )
        .groupBy(payRows.runId)
    : []
  const people = new Map(counts.map((c) => [c.runId, c.n]))
  return runs.map((run) => ({
    run,
    people: people.get(run.id) ?? 0,
    label: periodLabel({ from: run.periodFrom, to: run.periodTo }),
  }))
}

/** A run with its rows and each batch's relay state, for the review screen and the run page. */
export async function getRun(db: Db, workspaceId: string, runId: string) {
  const run = await ownRun(db, workspaceId, runId)
  const rows = await db
    .select({ row: payRows, relayStatus: relays.status, usual: people.amount })
    .from(payRows)
    .leftJoin(relays, eq(relays.id, payRows.relayId))
    .leftJoin(people, eq(people.id, payRows.personId))
    .where(eq(payRows.runId, run.id))
    .orderBy(asc(payRows.name))
  return { run, rows, label: periodLabel({ from: run.periodFrom, to: run.periodTo }) }
}

/** Home's "Payroll due": the next payday has come and it has no approved run. */
export async function payrollDue(
  db: Db,
  workspaceId: string,
  network: NetworkId,
  timezone: string,
) {
  const next = await nextPaydayFor(db, workspaceId, network)
  if (!next || next.payday > localToday(timezone)) return null
  const team = await listPeople(db, workspaceId, network)
  const ready = team.filter((m) => m.ready.state === "ready")
  if (!team.length) return null
  return {
    payday: next.payday,
    people: ready.length,
    total: ready.reduce((sum, m) => sum + m.person.amount, 0n),
  }
}

// --- the person's side ---------------------------------------------------------------------------------------------

/** What `/p/<token>` shows: who added them, their pay, where it lands now (and any change waiting), their payslips. */
export async function personPage(db: Db, token: string) {
  const row = await personByToken(db, token).catch(() => undefined)
  if (!row) return undefined
  const { person } = row
  const [destinations, tegata, schedule] = await Promise.all([
    destinationsFor(db, [person.id]),
    tegataAccounts(db, person.userId ? [person.userId] : [], person.network),
    getSchedule(db, person.workspaceId, person.network),
  ])
  const { active, pending } = currentDestination(destinations.get(person.id) ?? [])
  const account = person.userId ? tegata.get(person.userId) : undefined
  const slips = await db
    .select({
      id: payRows.id,
      amount: payRows.amount,
      paidAt: payRows.paidAt,
      from: payRuns.periodFrom,
      to: payRuns.periodTo,
    })
    .from(payRows)
    .innerJoin(payRuns, eq(payRuns.id, payRows.runId))
    .where(and(eq(payRows.personId, person.id), eq(payRows.status, "paid")))
    .orderBy(desc(payRows.paidAt))
  return {
    person,
    business: row.business,
    logo: headerLogo(row),
    cadence: schedule?.cadence ?? null,
    emailHint: person.email ? maskEmail(person.email) : null,
    claimed: Boolean(person.userId),
    ready: readiness(active, account),
    pending: pending && {
      kind: pending.kind,
      accountId: pending.accountId ?? account?.accountId ?? null,
      route: pending.route,
      activatesAt: pending.activatesAt,
    },
    slips: slips.map((slip) => ({ ...slip, label: periodLabel({ from: slip.from, to: slip.to }) })),
  }
}

/** Payslips paid to this user's Tegata or NEAR accounts, newest first (the person's Activity). */
export async function payslipsFor(db: Db, userId: string, limit = 20) {
  return db
    .select({
      id: payRows.id,
      amount: payRows.amount,
      paidAt: payRows.paidAt,
      txHash: payRows.txHash,
      network: payRuns.network,
      business: workspaces.name,
    })
    .from(payRows)
    .innerJoin(people, eq(people.id, payRows.personId))
    .innerJoin(payRuns, eq(payRuns.id, payRows.runId))
    .innerJoin(workspaces, eq(workspaces.id, payRuns.workspaceId))
    .where(and(eq(people.userId, userId), eq(payRows.status, "paid")))
    .orderBy(desc(payRows.paidAt))
    .limit(limit)
}

/** Runs that left the business, for its Activity. */
export async function runsOut(db: Db, workspaceId: string, limit = 20) {
  return db
    .select()
    .from(payRuns)
    .where(
      and(
        eq(payRuns.workspaceId, workspaceId),
        inArray(payRuns.status, ["approved", "paid", "failed"]),
      ),
    )
    .orderBy(desc(payRuns.approvedAt))
    .limit(limit)
}

/** The payslip at `/r/slip/<row>`: public by its random id, like a receipt token. Undefined until paid. */
export async function payslip(db: Db, rowId: string) {
  if (!UUID.test(rowId)) return undefined
  const [row] = await db
    .select({ row: payRows, run: payRuns, ...BUSINESS_HEADER })
    .from(payRows)
    .innerJoin(payRuns, eq(payRuns.id, payRows.runId))
    .innerJoin(workspaces, eq(workspaces.id, payRuns.workspaceId))
    .where(and(eq(payRows.id, rowId), eq(payRows.status, "paid")))
  if (!row) return undefined
  // Paid to another chain: the NEAR Intents payout that carried it, for what arrived and where.
  const [payout] = row.row.payoutId
    ? await db.select().from(payouts).where(eq(payouts.id, row.row.payoutId))
    : []
  return {
    row: row.row,
    run: row.run,
    payout: payout ?? null,
    business: row.business,
    logo: headerLogo(row),
    label: periodLabel({ from: row.run.periodFrom, to: row.run.periodTo }),
  }
}

const CADENCE_WORD = { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly" } as const
const LINE_WORD = {
  bonus: "Bonus",
  reimbursement: "Reimbursement",
  deduction: "Deduction",
} as const

/**
 * Everything the payslip PDF shows, from a paid row: the business's header, the person (masked email), the period
 * and pay date, gross to net with this year's pay to date, and how the money moved (the NEAR transaction, and what
 * NEAR Intents delivered on another chain). Built on demand from the paid row, so every paid row has one.
 */
export async function payslipDocument(db: Db, rowId: string, appUrl: string) {
  const slip = await payslip(db, rowId)
  if (!slip?.row.paidAt) return undefined
  const { row, run, payout } = slip
  const paidAt = slip.row.paidAt
  const [[business], [person], [schedule], logo] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.id, run.workspaceId)),
    db.select().from(people).where(eq(people.id, row.personId)),
    db
      .select({ cadence: payrolls.cadence })
      .from(payrolls)
      .where(and(eq(payrolls.workspaceId, run.workspaceId), eq(payrolls.network, run.network))),
    businessLogo(db, run.workspaceId),
  ])
  if (!business) return undefined
  const timezone = business.timezone
  const year = Number(
    new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: timezone }).format(paidAt),
  )
  // Year to date: this person's paid rows from this business this calendar year, this one included, as gross pay
  // (pay and additions) and as pay alone.
  const yearRows = await db
    .select({ amount: payRows.amount, basePay: payRows.basePay, lines: payRows.lines })
    .from(payRows)
    .where(
      and(
        eq(payRows.personId, row.personId),
        eq(payRows.status, "paid"),
        sql`extract(year from ${payRows.paidAt} at time zone ${timezone}) = ${year}`,
        lte(payRows.paidAt, paidAt),
      ),
    )
  const ytd = yearRows.reduce(
    (sum, r) => {
      const base = rowBasePay(r)
      return { pay: sum.pay + base, gross: sum.gross + rowBreakdown(base, payLines(r.lines)).gross }
    },
    { pay: 0n, gross: 0n },
  )
  const lines = payLines(row.lines)
  const base = rowBasePay(row)
  const figures = rowBreakdown(base, lines)
  const lineLabel = (line: PayLine) =>
    line.label ? `${LINE_WORD[line.kind]} · ${line.label}` : LINE_WORD[line.kind]
  const when = (date: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(date)
  const chain = payout ? `${payout.symbol} on ${payout.chain}` : null
  return {
    kind: "payslip" as const,
    reference: `PS-${row.id.slice(0, 8).toUpperCase()}`,
    business: {
      name: business.name,
      address: business.address,
      taxId: business.taxId,
      email: business.email,
      logo:
        logo && (logo.type === "image/png" || logo.type === "image/jpeg")
          ? `data:${logo.type};base64,${logo.bytes.toString("base64")}`
          : null,
      accountId: run.senderId,
    },
    person: {
      name: row.name,
      role: row.role,
      reference: `P-${row.personId.slice(0, 6).toUpperCase()}`,
      email: person?.email ? maskEmail(person.email) : null,
    },
    periodLabel: slip.label,
    periodFrom: run.periodFrom,
    periodTo: run.periodTo,
    payDate: run.payday,
    paidAt: when(paidAt),
    timezone,
    frequency: schedule ? CADENCE_WORD[schedule.cadence] : null,
    gross: figures.gross.toString(),
    deductions: figures.deductions.toString(),
    net: row.amount.toString(),
    yearToDate: (ytd.gross || figures.gross).toString(),
    earnings: [
      {
        label: row.role ? `Pay · ${row.role}` : "Pay",
        amount: base.toString(),
        yearToDate: (ytd.pay || base).toString(),
      },
      ...lines
        .filter((line) => line.kind !== "deduction")
        .map((line) => ({
          label: lineLabel(line),
          amount: line.amount.toString(),
          yearToDate: null,
        })),
    ],
    deductionLines: lines
      .filter((line) => line.kind === "deduction")
      .map((line) => ({ label: lineLabel(line), amount: line.amount.toString() })),
    year,
    how: {
      paidIn: chain ? `${chain}, converted by NEAR Intents` : "USDC on NEAR, issued by Circle",
      to: payout ? payout.recipient : (row.accountId ?? ""),
      toKind: payout
        ? `Address on ${payout.chain}`
        : row.destinationKind === "near"
          ? "NEAR account"
          : "Tegata account",
      delivered:
        payout?.amountOutFormatted && payout.symbol
          ? `${Number(payout.amountOutFormatted).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${payout.symbol}`
          : null,
      deliveryTx: payout?.destinationTx ?? null,
      deliveryTxUrl:
        payout?.destinationTx && payout.chain
          ? deliveryTxUrl(payout.chain, payout.destinationTx)
          : null,
      nearTx: row.txHash,
      nearTxUrl: row.txHash ? explorerTx(run.network, row.txHash) : null,
      memo: payrollMemo(row.id),
      autopilot: run.source === "autopilot",
    },
    checkUrl: `${appUrl.replace(/\/$/, "")}/r/slip/${row.id}`,
    sandbox: run.network === "testnet",
    madeAt: when(new Date()),
  }
}

/** Who a person's sign-in email belongs to, for the invite on their page. */
export async function userEmail(db: Db, userId: string) {
  const [row] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId))
  return row?.email ?? null
}

/** People a business can pick in Send: the ready ones, with the account they'd be paid at. */
export async function sendablePeople(db: Db, workspaceId: string, network: NetworkId) {
  const team = await listPeople(db, workspaceId, network)
  return team.flatMap((m) =>
    m.ready.state === "ready"
      ? [
          {
            id: m.person.id,
            name: m.person.name,
            role: m.person.role,
            accountId: m.ready.accountId,
          },
        ]
      : [],
  )
}
