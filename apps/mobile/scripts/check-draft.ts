// Parity check: the phone's borsh encoder (src/near/draft.ts) must hash every draft exactly as the server's
// near-api-js path does (`@tegata/core/near` delegateHash), and must name a Privy NEAR wallet's key exactly as NEAR does
// (the phone signs with the wallet whose key a draft names). Run: pnpm --filter @tegata/mobile check:draft
import { strict as assert } from "node:assert"
import { createRequire } from "node:module"

import { delegateHash, ftTransfer } from "@tegata/core/near"

import { draftHash, nearPublicKey } from "../src/near/draft.ts"

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

// near-api-js is @tegata/core's dependency, not the phone's: load it from there, so the check is independent of the
// phone's own base58.
interface NearKeys {
  KeyPair: {
    fromRandom(curve: "ed25519"): { getPublicKey(): { data: Uint8Array; toString(): string } }
  }
}
const fromCore = createRequire(require.resolve("@tegata/core/near"))
const { KeyPair } = fromCore("near-api-js") as NearKeys
const KEYS = 24
for (let i = 0; i < KEYS; i++) {
  const publicKey = KeyPair.fromRandom("ed25519").getPublicKey()
  const address = toHex(publicKey.data)
  assert.equal(nearPublicKey(address), publicKey.toString())
  assert.equal(nearPublicKey(`0x${address.toUpperCase()}`), publicKey.toString())
}
console.log(`Privy wallet address to NEAR key matches near-api-js on ${KEYS} keys`)
