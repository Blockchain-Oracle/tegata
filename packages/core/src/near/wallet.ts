// Signing in with a NEAR wallet, and taking a wallet's own signature for a gas-free action.
//
// Sign-in is NEP-413: the wallet signs "Sign in to Tegata" with a server nonce, and `verifyMessage` checks the
// signature and that the key is a full-access key on the account. An action is a NEP-366 delegate action the wallet
// signs itself (NEAR Connect's `signDelegateActions`), so the wallet picks its own nonce, expiry and key; the server
// accepts it only if it is byte for byte the delegate it drafted, apart from those three.
import { base58, base64 } from "@scure/base"
import { NETWORKS, type NetworkId } from "@tegata/config"
import {
  actions,
  DelegateAction,
  encodeSignedDelegate,
  KeyType,
  PublicKey,
  Signature,
} from "near-api-js"
import { verifyMessage } from "near-api-js/nep413"

import { toAction } from "./calls.ts"
import { type DelegateDraft, delegateHash } from "./delegate.ts"
import { nearProvider } from "./provider.ts"

export const SIGN_IN_MESSAGE = "Sign in to Tegata"
export const SIGN_IN_RECIPIENT = "Tegata"

/** The network an account name belongs to, or null for an implicit account (its name doesn't say). */
export function walletAccountNetwork(accountId: string): NetworkId | null {
  if (accountId.endsWith(".testnet")) return "testnet"
  if (accountId.endsWith(".near")) return "mainnet"
  return null
}

/** True when `accountId` is one of Tegata's own (`name.tegata.testnet`), which only email sign-in controls. */
export function isTegataAccount(accountId: string): boolean {
  return Object.values(NETWORKS).some((n) => accountId.endsWith(`.${n.operator}`))
}

/** Bytes from base64 (what wallets send) or, failing that, base58. */
export function walletBytes(value: string): Uint8Array {
  const trimmed = value.trim()
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0) {
    try {
      return base64.decode(trimmed)
    } catch {
      // Not base64 after all.
    }
  }
  return base58.decode(trimmed)
}

/** Throws unless the wallet signed the sign-in message, for this nonce, with a full-access key on the account. */
export async function verifySignIn(input: {
  network: NetworkId
  accountId: string
  publicKey: string
  /** Base64 (or base58) of the 64-byte signature. */
  signature: string
  nonce: Uint8Array
}): Promise<void> {
  await verifyMessage({
    signerAccountId: input.accountId,
    signerPublicKey: input.publicKey,
    payload: { message: SIGN_IN_MESSAGE, recipient: SIGN_IN_RECIPIENT, nonce: input.nonce },
    signature: walletBytes(input.signature),
    provider: nearProvider(input.network),
  })
}

const U64 = 8
const ED25519_KEY = 32
const ED25519_SIGNATURE = 64
/** nonce + max block height + key (type byte + 32) + signature (type byte + 64). */
const ED25519_TAIL = U64 + U64 + 1 + ED25519_KEY + 1 + ED25519_SIGNATURE

const readU64 = (bytes: Uint8Array, at: number) =>
  new DataView(bytes.buffer, bytes.byteOffset + at, U64).getBigUint64(0, true)

export class WalletDelegateError extends Error {
  override name = "WalletDelegateError"
}

/**
 * Take a wallet's signed delegate action for `draft`. Returns the draft with the wallet's nonce, expiry and key (so
 * the relay rebuilds exactly what the wallet signed) and the signature in base64. Throws when it is anything other
 * than the drafted action, signed by an ed25519 key.
 */
export function adoptWalletDelegate(
  draft: DelegateDraft,
  signedDelegate: string,
): { draft: DelegateDraft; signature: string } {
  const bytes = walletBytes(signedDelegate)
  if (bytes.length <= ED25519_TAIL)
    throw new WalletDelegateError("The wallet's answer is too short")
  const tail = bytes.length - ED25519_TAIL
  const nonce = readU64(bytes, tail)
  const maxBlockHeight = readU64(bytes, tail + U64)
  const keyAt = tail + U64 + U64
  const sigAt = keyAt + 1 + ED25519_KEY
  if (bytes[keyAt] !== KeyType.ED25519 || bytes[sigAt] !== KeyType.ED25519)
    throw new WalletDelegateError("Only ed25519 keys can approve actions")
  const publicKey = new PublicKey({
    keyType: KeyType.ED25519,
    data: bytes.slice(keyAt + 1, keyAt + 1 + ED25519_KEY),
  })
  const signature = bytes.slice(sigAt + 1, sigAt + 1 + ED25519_SIGNATURE)

  const adopted = {
    senderId: draft.senderId,
    receiverId: draft.receiverId,
    publicKey: publicKey.toString(),
    calls: draft.calls,
    nonce: nonce.toString(),
    maxBlockHeight: maxBlockHeight.toString(),
  }
  const expected = encodeSignedDelegate(
    signedDelegateOf(
      new DelegateAction({
        senderId: adopted.senderId,
        receiverId: adopted.receiverId,
        actions: adopted.calls.map(toAction),
        nonce,
        maxBlockHeight,
        publicKey,
      }),
      signature,
    ),
  )
  if (!sameBytes(expected, bytes))
    throw new WalletDelegateError("The wallet signed something other than this action")
  const hash = delegateHash(adopted)
  if (!publicKey.verify(hash, signature))
    throw new WalletDelegateError("The wallet's signature doesn't check out")
  const hex = Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("")
  return {
    draft: { ...adopted, network: draft.network, hash: hex },
    signature: base64.encode(signature),
  }
}

/** A SignedDelegate (near-api-js builds it inside the action; the class itself isn't exported). */
export function signedDelegateOf(delegateAction: DelegateAction, signature: Uint8Array) {
  const action = actions.signedDelegate({
    delegateAction,
    signature: new Signature({ keyType: KeyType.ED25519, data: signature }),
  })
  if (!action.signedDelegate) throw new Error("near-api-js built no signed delegate")
  return action.signedDelegate
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i])
}
