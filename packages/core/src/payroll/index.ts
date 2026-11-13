/**
 * Payroll's pure logic: paydays in the business's own calendar, the period a run pays for, batches that
 * fit one all-or-nothing NEAR action list, and the people CSV with an error per row. No I/O; the services call this.
 */

import { LIMITS } from "@tegata/config"

import { parseDollars } from "../invoices/index.ts"

export type PayCadence = "weekly" | "fortnightly" | "monthly"

export const PAYROLL_LIMITS = {
  /** People one business can pay. */
  people: 200,
  name: 80,
  role: 60,
  email: 120,
  /** USDC base units: $1,000,000 per person per run. */
  maxPay: 1_000_000n * 1_000_000n,
  /** `ft_transfer` actions in one all-or-nothing batch (the relay policy's cap). */
  rowsPerBatch: LIMITS.maxRowsPerBatch,
  /** A person's change of where pay lands waits this long (Kawase's address-change cooldown). */
  destinationCooldownMs: 24 * 60 * 60 * 1000,
} as const

const DAY_MS = 86_400_000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}
const iso = (d: Date) => d.toISOString().slice(0, 10)
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

/** The payday after `payday`. Monthly keeps `anchorDay`, landing on the last day of shorter months. */
export function nextPayday(cadence: PayCadence, payday: string, anchorDay: number): string {
  const d = toDate(payday)
  if (cadence === "weekly") return iso(new Date(d.getTime() + 7 * DAY_MS))
  if (cadence === "fortnightly") return iso(new Date(d.getTime() + 14 * DAY_MS))
  const year = d.getUTCMonth() === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()
  const month = (d.getUTCMonth() + 1) % 12 // 0-based month after this one
  const day = Math.min(anchorDay, daysIn(year, month + 1))
  return iso(new Date(Date.UTC(year, month, day)))
}

/** The day a monthly schedule keeps: 31 when the payday is its month's last day, so it stays "end of month". */
export function anchorDayFor(payday: string): number {
  const d = toDate(payday)
  return d.getUTCDate() === daysIn(d.getUTCFullYear(), d.getUTCMonth() + 1) ? 31 : d.getUTCDate()
}

export interface PaySchedule {
  cadence: PayCadence
  firstPayday: string
  anchorDay: number
}

/** Enough steps for decades of weekly paydays; a guard, never reached in practice. */
const MAX_STEPS = 2_000

/** The first payday of a schedule after `last` (the latest payday already run), or its first one. */
export function paydayAfter(schedule: PaySchedule, last: string | null): string {
  let day = schedule.firstPayday
  for (let i = 0; last && day <= last && i < MAX_STEPS; i++) {
    day = nextPayday(schedule.cadence, day, schedule.anchorDay)
  }
  return day
}

/** The days a run on `payday` pays for: the cadence's span ending on payday. */
export function payPeriod(cadence: PayCadence, payday: string): { from: string; to: string } {
  const to = toDate(payday)
  if (cadence === "monthly") {
    const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 1, to.getUTCDate() + 1))
    return { from: iso(from), to: payday }
  }
  const span = cadence === "weekly" ? 7 : 14
  return { from: iso(new Date(to.getTime() - (span - 1) * DAY_MS)), to: payday }
}

/** "Pay · 1–30 Nov 2026", or across months "Pay · 25 Nov – 8 Dec 2026". */
export function periodLabel(period: { from: string; to: string }): string {
  const from = toDate(period.from)
  const to = toDate(period.to)
  const day = (d: Date) => d.getUTCDate()
  const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })
  const year = to.getUTCFullYear()
  if (from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === year)
    return `Pay · ${day(from)}–${day(to)} ${month(to)} ${year}`
  const fromYear = from.getUTCFullYear() === year ? "" : ` ${from.getUTCFullYear()}`
  return `Pay · ${day(from)} ${month(from)}${fromYear} – ${day(to)} ${month(to)} ${year}`
}

/** Split rows into all-or-nothing batches no larger than one relayed action list allows. */
export function batches<T>(rows: readonly T[], size: number = PAYROLL_LIMITS.rowsPerBatch): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

export interface PersonRow {
  /** The CSV line number (1 is the header). */
  line: number
  name: string
  email: string | null
  role: string | null
  amount: bigint
}

export interface CsvProblem {
  line: number
  message: string
}

/** One CSV record, honouring quotes ("Kofi, Jr." stays one field; "" is a quote). */
function splitRecord(line: string): string[] {
  const fields: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") {
      fields.push(field)
      field = ""
    } else field += ch
  }
  fields.push(field)
  return fields.map((f) => f.trim())
}

const COLUMNS = {
  name: ["name", "full name"],
  email: ["email", "e-mail", "email address"],
  role: ["role", "title", "job title"],
  amount: ["amount", "pay", "salary", "pay per run", "usd"],
} as const

/**
 * The people CSV: a header row naming `name`, `email`, `role` and `amount` (any order, a few common spellings), then
 * one person per line. Good rows come back ready to save; every bad row comes back with what to fix, so one typo
 * never blocks the rest.
 */
export function parsePeopleCsv(text: string): { rows: PersonRow[]; problems: CsvProblem[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/)
  const header = splitRecord(lines[0] ?? "").map((h) => h.toLowerCase())
  const index = (names: readonly string[]) => header.findIndex((h) => names.includes(h))
  const at = {
    name: index(COLUMNS.name),
    email: index(COLUMNS.email),
    role: index(COLUMNS.role),
    amount: index(COLUMNS.amount),
  }
  const problems: CsvProblem[] = []
  if (at.name < 0 || at.amount < 0) {
    return {
      rows: [],
      problems: [{ line: 1, message: "The first row needs at least name and amount" }],
    }
  }
  const rows: PersonRow[] = []
  const seen = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i] ?? ""
    if (!raw.trim()) continue
    const line = i + 1
    const cells = splitRecord(raw)
    const name = cells[at.name] ?? ""
    const email = at.email >= 0 ? (cells[at.email] ?? "").toLowerCase() : ""
    const role = at.role >= 0 ? (cells[at.role] ?? "") : ""
    const amountText = (cells[at.amount] ?? "").replace(/^\$/, "")
    const amount = parseDollars(amountText)
    if (!name) problems.push({ line, message: "Name is empty" })
    else if (name.length > PAYROLL_LIMITS.name) problems.push({ line, message: "Name is too long" })
    else if (email && !EMAIL.test(email))
      problems.push({ line, message: `"${email}" isn't an email` })
    else if (email && seen.has(email)) problems.push({ line, message: `${email} is listed twice` })
    else if (amount === null || amount <= 0n)
      problems.push({
        line,
        message: `"${cells[at.amount] ?? ""}" isn't an amount like 2400 or 2,400.50`,
      })
    else if (amount > PAYROLL_LIMITS.maxPay) problems.push({ line, message: "Amount is too large" })
    else {
      if (email) seen.add(email)
      rows.push({
        line,
        name,
        email: email || null,
        role: role.slice(0, PAYROLL_LIMITS.role) || null,
        amount,
      })
    }
  }
  return { rows, problems }
}
