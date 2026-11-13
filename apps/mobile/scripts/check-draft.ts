// Parity check: the phone's borsh encoder (src/near/draft.ts) must hash every draft exactly as the server's
// near-api-js path does (`@tegata/core/near` delegateHash). Run: pnpm --filter @tegata/mobile check:draft
import { strict as assert } from "node:assert"

import { delegateHash, ftTransfer } from "@tegata/core/near"

import { draftHash } from "../src/near/draft.ts"

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")

const KEY = "ed25519:9Kj4sq2RAjwjBbBNNZCmCDN1Nsrq1pS4cyhDy5ToKeYd"
const cases = [
  {
    senderId: "abu.tegata.testnet",
    receiverId: "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af",
    publicKey: KEY,
    calls: [ftTransfer("zainab.tegata.testnet", 25_500_000n, "tegata:send")],
    nonce: "184467440737095",
    maxBlockHeight: "212345678",
  },
  {
    senderId: "studio.tegata.near",
    receiverId: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    publicKey: KEY,
    calls: [
      ftTransfer("a.tegata.near", 1_000_000_000n, "tegata:payroll:7f1c"),
      ftTransfer("b.tegata.near", 2_500_000_000n, "tegata:payroll:8a2d"),
      ftTransfer("c".repeat(64), 990_000n),
    ],
    nonce: "1",
    maxBlockHeight: "18446744073709551615",
  },
]

for (const draft of cases) {
  assert.equal(draftHash(draft), toHex(delegateHash(draft)))
}
console.log(`draft encoder matches @tegata/core/near on ${cases.length} drafts`)
