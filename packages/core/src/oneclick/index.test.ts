// The quote-signature check against 1Click's own signed quotes (a live dry quote; network needed).
import assert from "node:assert/strict"
import { test } from "node:test"

import { requestQuote, stableStringify, verifyQuote } from "./index.ts"

test("stable stringify sorts keys and leaves out undefined", () => {
  assert.equal(
    stableStringify({ b: 1, a: "x", c: undefined, d: [2, { z: true, y: null }] }),
    '{"a":"x","b":1,"d":[2,{"y":null,"z":true}]}',
  )
})

test("a real 1Click quote verifies; a changed one doesn't", {
  skip: !process.env.ONECLICK_LIVE_TEST,
}, async () => {
  const response = await requestQuote({
    dry: true,
    swapType: "EXACT_OUTPUT",
    slippageTolerance: 10,
    originAsset: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    depositType: "ORIGIN_CHAIN",
    destinationAsset: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    amount: "5000000",
    refundTo: "0x2527D02599Ba641c19FEa793cD0F167589a0f10D",
    refundType: "ORIGIN_CHAIN",
    recipient: "near",
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + 20 * 60_000).toISOString(),
  })
  assert.equal(verifyQuote(response), true)
  assert.equal(verifyQuote({ ...response, quote: { ...response.quote, amountIn: "1" } }), false)
  assert.equal(
    verifyQuote({
      ...response,
      quoteRequest: { ...response.quoteRequest, recipient: "thief.near" },
    }),
    false,
  )
})
