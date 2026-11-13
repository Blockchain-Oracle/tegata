import assert from "node:assert/strict"
import { test } from "node:test"

import { maxConversionExtra } from "@tegata/config"

import { quoteProblem, usdcToTokenUnits } from "./index.ts"

test("a payroll row's pay in a stablecoin's own decimals", () => {
  // $2,400.00 in USDC units (6 decimals).
  const pay = 2_400_000_000n
  assert.equal(usdcToTokenUnits(pay, 6), 2_400_000_000n) // USDT on Tron, USDC on Base
  assert.equal(usdcToTokenUnits(pay, 18), 2_400_000_000_000_000_000_000n) // USDT on BNB Chain
  assert.equal(usdcToTokenUnits(1_234_567n, 2), 123n) // fewer decimals round down, never over the pay
})

test("what delivering exactly the pay may add on top", () => {
  // $10 pay: 2% is 20¢, so the $1 floor applies.
  assert.equal(maxConversionExtra(10_000_000n), 1_000_000n)
  // $2,400 pay: 2% is $48.
  assert.equal(maxConversionExtra(2_400_000_000n), 48_000_000n)
})

test("1Click's refusals read as dollars and plain words", () => {
  assert.equal(
    quoteProblem("Amount is too low for bridge, try at least 149983", "USDC on Base"),
    "USDC on Base needs at least $0.15 right now",
  )
  assert.equal(
    quoteProblem("Temporary swap limits: minimum swap amount is $100", "USDT on Tron"),
    "USDT on Tron needs at least $100 right now",
  )
  assert.equal(
    quoteProblem(
      "Amount is too low for bridge, try at least 1500000000000000000",
      "USDC on BNB Chain",
      18,
    ),
    "USDC on BNB Chain needs at least $1.50 right now",
  )
  assert.match(quoteProblem("refundTo is not valid", "USDT on Tron"), /refund address/)
  assert.match(quoteProblem("recipient is not valid", "USDT on Tron"), /That address/)
  assert.match(quoteProblem(undefined, "BTC on Bitcoin"), /can't price BTC on Bitcoin/)
})
