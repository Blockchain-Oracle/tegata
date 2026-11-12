/**
 * When a repeating invoice runs next, in the business's own time zone, using only `Intl` (the approach of Kawase's
 * `nextRuns()`). Unlike Kawase, a monthly run on the 31st lands on the last day of shorter months instead of the 28th.
 */

export type Cadence = "weekly" | "monthly"

/** Repeating invoices are issued at 09:00 local time. */
export const RUN_HOUR = 9

interface LocalDate {
  year: number
  month: number // 1–12
  day: number
}

function partsIn(timezone: string, at: Date): LocalDate & { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  }
}

/** The instant when the wall clock in `timezone` reads date at hour:00. Two passes settle daylight-saving changes. */
export function atLocal(date: LocalDate, hour: number, timezone: string): Date {
  const wanted = Date.UTC(date.year, date.month - 1, date.day, hour)
  let guess = wanted
  for (let i = 0; i < 2; i++) {
    const seen = partsIn(timezone, new Date(guess))
    const shown = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute)
    guess += wanted - shown
  }
  return new Date(guess)
}

/** `YYYY-MM-DD` as the business sees today. */
export function localToday(timezone: string, now = new Date()): string {
  const p = partsIn(timezone, now)
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

/** The run after `after`: a week later, or the same day of the next month (clamped to its last day). */
export function nextRun(cadence: Cadence, after: Date, timezone: string, anchorDay: number): Date {
  const local = partsIn(timezone, after)
  let date: LocalDate
  if (cadence === "weekly") {
    const plus = new Date(Date.UTC(local.year, local.month - 1, local.day + 7))
    date = { year: plus.getUTCFullYear(), month: plus.getUTCMonth() + 1, day: plus.getUTCDate() }
  } else {
    const month = local.month === 12 ? 1 : local.month + 1
    const year = local.month === 12 ? local.year + 1 : local.year
    date = { year, month, day: Math.min(anchorDay, daysIn(year, month)) }
  }
  return atLocal(date, RUN_HOUR, timezone)
}

/** `YYYY-MM-DD` plus whole days. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10)
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}
