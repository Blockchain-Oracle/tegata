// The relay policy for wallet-signed actions: only the drafted delegate, signed by the key it names, is accepted.
import assert from "node:assert/strict"
import { test } from "node:test"

import { base64 } from "@scure/base"
import { DelegateAction, encodeSignedDelegate, KeyPair } from "near-api-js"

import { toAction } from "./calls.ts"
import { type DelegateDraft, delegateHash } from "./delegate.ts"
import { ftTransfer } from "./usdc.ts"
import { adoptWalletDelegate, signedDelegateOf, WalletDelegateError } from "./wallet.ts"

const USDC = "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af"
const serverKey = KeyPair.fromRandom("ed25519")
const walletKey = KeyPair.fromRandom("ed25519")

// What the server drafts: a USDC transfer from the wallet's account.
const body = {
  senderId: "abu.testnet",
  receiverId: USDC,
  publicKey: serverKey.getPublicKey().toString(),
  calls: [ftTransfer("shop.testnet", 250_000n, "tegata:pay:1")],
  nonce: "11",
  maxBlockHeight: "1000",
}
const draft: DelegateDraft = { network: "testnet", ...body, hash: "" }

/** What a wallet returns: its own nonce, expiry and key, signed, borsh-encoded, base64. */
function walletSigns(calls = body.calls, senderId = body.senderId, key = walletKey) {
  const signed = {
    ...body,
    senderId,
    calls,
    publicKey: key.getPublicKey().toString(),
    nonce: "42",
    maxBlockHeight: "2000",
  }
  const { signature } = key.sign(delegateHash(signed))
  return base64.encode(
    encodeSignedDelegate(
      signedDelegateOf(
        new DelegateAction({
          senderId: signed.senderId,
          receiverId: signed.receiverId,
          actions: signed.calls.map(toAction),
          nonce: 42n,
          maxBlockHeight: 2000n,
          publicKey: key.getPublicKey(),
        }),
        signature,
      ),
    ),
  )
}

test("a wallet's signature of the drafted action is adopted with its nonce, expiry and key", () => {
  const { draft: adopted, signature } = adoptWalletDelegate(draft, walletSigns())
  assert.equal(adopted.nonce, "42")
  assert.equal(adopted.maxBlockHeight, "2000")
  assert.equal(adopted.publicKey, walletKey.getPublicKey().toString())
  assert.deepEqual(adopted.calls, draft.calls)
  assert.ok(walletKey.verify(delegateHash(adopted), base64.decode(signature)))
})

test("a different action, sender or amount is refused", () => {
  const other = [ftTransfer("thief.testnet", 250_000n, "tegata:pay:1")]
  assert.throws(() => adoptWalletDelegate(draft, walletSigns(other)), WalletDelegateError)
  const more = [ftTransfer("shop.testnet", 9_000_000n, "tegata:pay:1")]
  assert.throws(() => adoptWalletDelegate(draft, walletSigns(more)), WalletDelegateError)
  assert.throws(
    () => adoptWalletDelegate(draft, walletSigns(body.calls, "mallory.testnet")),
    WalletDelegateError,
  )
})

test("a signature that doesn't match its key is refused", () => {
  const bytes = base64.decode(walletSigns())
  bytes[bytes.length - 1] = (bytes.at(-1) ?? 0) ^ 1
  assert.throws(() => adoptWalletDelegate(draft, base64.encode(bytes)), WalletDelegateError)
})
