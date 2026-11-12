import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CENT,
  invoiceNumber,
  invoiceTotals,
  lineAmount,
  parseDollars,
  parsePercent,
  parseQuantity,
  percentText,
  quantityText,
} from "./index.ts"

const dollars = (n: number) => BigInt(Math.round(n * 100)) * CENT

test("a line is quantity × price, rounded half-up to the cent", () => {
  assert.equal(lineAmount({ quantityMilli: 1_000n, unitPrice: dollars(29) }), dollars(29))
  // 1.333 hours × $45.00 = 59.985 → 59.99
  assert.equal(lineAmount({ quantityMilli: 1_333n, unitPrice: dollars(45) }), dollars(59.99))
  // 0.005 × $1.00 = 0.005 → 0.01 (half-up)
  assert.equal(lineAmount({ quantityMilli: 5n, unitPrice: dollars(1) }), dollars(0.01))
  // 0.004 × $1.00 = 0.004 → 0.00
  assert.equal(lineAmount({ quantityMilli: 4n, unitPrice: dollars(1) }), 0n)
})

test("discount comes off the subtotal, tax applies to what is left", () => {
  const lines = [
    { quantityMilli: 4_000n, unitPrice: dollars(29) }, // 116.00
    { quantityMilli: 3_000n, unitPrice: dollars(10) }, // 30.00
    { quantityMilli: 6_000n, unitPrice: dollars(9) }, // 54.00
  ]
  const t = invoiceTotals(lines, { kind: "percent", bp: 1_000 }, 750)
  assert.equal(t.subtotal, dollars(200))
  assert.equal(t.discount, dollars(20))
  assert.equal(t.tax, dollars(13.5)) // 7.5% of 180.00
  assert.equal(t.total, dollars(193.5))
})

test("a fixed discount never exceeds the subtotal", () => {
  const t = invoiceTotals(
    [{ quantityMilli: 1_000n, unitPrice: dollars(50) }],
    { kind: "fixed", amount: dollars(80) },
    1_000,
  )
  assert.equal(t.discount, dollars(50))
  assert.equal(t.tax, 0n)
  assert.equal(t.total, 0n)
})

test("percent discounts and tax round to whole cents", () => {
  const t = invoiceTotals(
    [{ quantityMilli: 1_000n, unitPrice: dollars(33.33) }],
    { kind: "percent", bp: 333 },
    825,
  )
  // 3.33% of 33.33 = 1.109889 → 1.11 ; taxable 32.22 ; 8.25% = 2.65815 → 2.66
  assert.equal(t.discount, dollars(1.11))
  assert.equal(t.tax, dollars(2.66))
  assert.equal(t.total, dollars(34.88))
  assert.equal(t.total % CENT, 0n)
})

test("parsers accept what a person types and refuse the rest", () => {
  assert.equal(parseQuantity("1.5"), 1_500n)
  assert.equal(parseQuantity("0"), null)
  assert.equal(parseQuantity("1.2345"), null)
  assert.equal(parsePercent("7.5"), 750)
  assert.equal(parsePercent("100"), 10_000)
  assert.equal(parsePercent("100.01"), null)
  assert.equal(parseDollars("1,250.5"), dollars(1250.5))
  assert.equal(parseDollars("12.345"), null)
  assert.equal(quantityText(1_500n), "1.5")
  assert.equal(quantityText(2_000n), "2")
  assert.equal(percentText(750), "7.5")
  assert.equal(invoiceNumber(7), "INV-0007")
})
