import assert from "node:assert/strict"
import { test } from "node:test"

import { addDays, atLocal, daysBetween, localToday, nextRun } from "./schedule.ts"

test("09:00 local is the right instant across zones and daylight saving", () => {
  assert.equal(
    atLocal({ year: 2026, month: 11, day: 12 }, 9, "Africa/Lagos").toISOString(),
    "2026-11-12T08:00:00.000Z",
  )
  // New York: EDT (UTC−4) in October, EST (UTC−5) in November.
  assert.equal(
    atLocal({ year: 2026, month: 10, day: 30 }, 9, "America/New_York").toISOString(),
    "2026-10-30T13:00:00.000Z",
  )
  assert.equal(
    atLocal({ year: 2026, month: 11, day: 2 }, 9, "America/New_York").toISOString(),
    "2026-11-02T14:00:00.000Z",
  )
})

test("monthly on the 31st lands on each month's last day", () => {
  const tz = "Europe/London"
  const jan31 = atLocal({ year: 2027, month: 1, day: 31 }, 9, tz)
  const feb = nextRun("monthly", jan31, tz, 31)
  assert.equal(feb.toISOString(), "2027-02-28T09:00:00.000Z")
  const mar = nextRun("monthly", feb, tz, 31)
  assert.equal(mar.toISOString(), "2027-03-31T08:00:00.000Z") // BST from 28 March
})

test("weekly is seven local days later", () => {
  const tz = "Asia/Tokyo"
  const run = nextRun("weekly", atLocal({ year: 2026, month: 12, day: 28 }, 9, tz), tz, 28)
  assert.equal(run.toISOString(), "2027-01-04T00:00:00.000Z")
})

test("date helpers", () => {
  assert.equal(addDays("2026-11-12", 30), "2026-12-12")
  assert.equal(daysBetween("2026-11-12", "2026-11-09"), -3)
  assert.equal(localToday("Pacific/Auckland", new Date("2026-11-12T12:00:00Z")), "2026-11-13")
})
