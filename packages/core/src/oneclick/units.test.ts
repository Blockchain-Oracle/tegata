import assert from "node:assert/strict"
import { test } from "node:test"

import { maxConversionExtra } from "@tegata/config"

import { usdcToTokenUnits } from "./index.ts"

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
