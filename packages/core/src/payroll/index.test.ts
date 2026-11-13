import assert from "node:assert/strict"
import { test } from "node:test"

import {
  anchorDayFor,
  batches,
  nextPayday,
  parsePeopleCsv,
  paydayAfter,
  payLinesProblem,
  payPeriod,
  periodLabel,
  rowBreakdown,
  rowTotal,
} from "./index.ts"

const USD = 1_000_000n

test("monthly paydays keep their day and land on the last day of shorter months", () => {
  assert.equal(nextPayday("monthly", "2026-01-31", 31), "2026-02-28")
  assert.equal(nextPayday("monthly", "2026-02-28", 31), "2026-03-31")
  assert.equal(nextPayday("monthly", "2026-12-15", 15), "2027-01-15")
})

test("weekly and fortnightly paydays step by 7 and 14 days across months and years", () => {
  assert.equal(nextPayday("weekly", "2026-12-29", 29), "2027-01-05")
  assert.equal(nextPayday("fortnightly", "2026-11-20", 20), "2026-12-04")
})

test("the next payday follows the last run, and end-of-month stays end-of-month", () => {
  const schedule = {
    cadence: "monthly" as const,
    firstPayday: "2026-11-30",
    anchorDay: anchorDayFor("2026-11-30"),
  }
  assert.equal(schedule.anchorDay, 31)
  assert.equal(paydayAfter(schedule, null), "2026-11-30")
  assert.equal(paydayAfter(schedule, "2026-11-30"), "2026-12-31")
  assert.equal(paydayAfter(schedule, "2027-01-31"), "2027-02-28")
  assert.equal(anchorDayFor("2026-11-15"), 15)
})

test("a run's period ends on payday and reads plainly", () => {
  assert.deepEqual(payPeriod("monthly", "2026-11-30"), { from: "2026-10-31", to: "2026-11-30" })
  assert.deepEqual(payPeriod("weekly", "2026-11-21"), { from: "2026-11-15", to: "2026-11-21" })
  assert.equal(periodLabel({ from: "2026-11-01", to: "2026-11-30" }), "Pay · 1–30 Nov 2026")
  assert.equal(periodLabel({ from: "2026-11-25", to: "2026-12-08" }), "Pay · 25 Nov – 8 Dec 2026")
})

test("batches never exceed 50 rows", () => {
  const rows = Array.from({ length: 120 }, (_, i) => i)
  assert.deepEqual(
    batches(rows).map((b) => b.length),
    [50, 50, 20],
  )
})

test("the people CSV keeps good rows and explains each bad one", () => {
  const csv = [
    "Name,Email,Role,Amount",
    'Mei Tanaka,mei@studio.example,Designer,"2,400"',
    '"Kofi, Jr.",kofi@studio.example,,$1800.50',
    ",nobody@studio.example,,100",
    "Sara,not-an-email,,100",
    "Diego,diego@studio.example,,abc",
    "Mei Again,MEI@studio.example,,100",
    "",
  ].join("\n")
  const { rows, problems } = parsePeopleCsv(csv)
  assert.deepEqual(
    rows.map((r) => [r.name, r.email, r.amount]),
    [
      ["Mei Tanaka", "mei@studio.example", 2_400n * USD],
      ["Kofi, Jr.", "kofi@studio.example", 1_800_500_000n],
    ],
  )
  assert.deepEqual(
    problems.map((p) => p.line),
    [4, 5, 6, 7],
  )
})

test("a CSV without name and amount columns is refused at the header", () => {
  assert.equal(parsePeopleCsv("email\nmei@studio.example").problems[0]?.line, 1)
})

test("a row's total is its pay plus bonuses and reimbursements, less deductions", () => {
  const lines = [
    { kind: "bonus" as const, label: "Q4 target", amount: 250n * USD },
    { kind: "reimbursement" as const, label: "Train", amount: 42_500_000n },
    { kind: "deduction" as const, label: "Advance", amount: 100n * USD },
  ]
  assert.equal(rowTotal(2_400n * USD, lines), 2_592_500_000n)
  assert.deepEqual(rowBreakdown(2_400n * USD, lines), {
    gross: 2_692_500_000n,
    deductions: 100n * USD,
    net: 2_592_500_000n,
  })
  assert.equal(payLinesProblem(2_400n * USD, lines), null)
})

test("pay lines refuse what can't be paid", () => {
  const deduction = (amount: bigint) => ({ kind: "deduction" as const, label: "", amount })
  assert.match(payLinesProblem(100n * USD, [deduction(100n * USD)]) ?? "", /can't be more/)
  assert.match(payLinesProblem(100n * USD, [deduction(0n)]) ?? "", /\$0.01/)
  assert.match(
    payLinesProblem(
      100n * USD,
      Array.from({ length: 11 }, () => deduction(USD)),
    ) ?? "",
    /Up to 10/,
  )
  assert.match(
    payLinesProblem(USD, [{ kind: "bonus", label: "x".repeat(61), amount: USD }]) ?? "",
    /label/,
  )
  assert.equal(payLinesProblem(0n, [{ kind: "bonus", label: "Only a bonus", amount: USD }]), null)
})
