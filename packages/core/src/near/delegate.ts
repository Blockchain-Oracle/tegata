import { sha256 } from "@noble/hashes/sha2.js"
import { LIMITS, type NetworkId } from "@tegata/config"
import {
  type Action,
  actions,
  base64Decode,
  base64Encode,
  DelegateAction,
  encodeDelegateAction,
  PublicKey,
  Signature,
} from "near-api-js"

import { type CallSpec, toAction } from "./calls.ts"
import { nearProvider } from "./provider.ts"

/**
 * A gas-free action waiting for the user's signature. Everything needed to rebuild the exact
 * NEP-366 delegate action travels as JSON, so the browser can re-encode it and check the hash
 * before it signs.
 */
export interface DelegateDraft {
  network: NetworkId
  senderId: string
  receiverId: string
  /** `ed25519:…` — the user's key that must sign. */
  publicKey: string
  calls: CallSpec[]
  nonce: string
  maxBlockHeight: string
  /** Hex SHA-256 of the borsh-encoded delegate action: the 32 bytes the user signs. */
  hash: string
}

function build(draft: Omit<DelegateDraft, "hash" | "network">): DelegateAction {
  return new DelegateAction({
    senderId: draft.senderId,
    receiverId: draft.receiverId,
    actions: draft.calls.map(toAction),
    nonce: BigInt(draft.nonce),
    maxBlockHeight: BigInt(draft.maxBlockHeight),
    publicKey: PublicKey.fromString(draft.publicKey),
  })
}

const HEX = 16
const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(HEX).padStart(2, "0")).join("")

/** The 32 bytes a signer signs for a delegate action. Same maths as near-api-js `signDelegateAction`. */
export function delegateHash(draft: Omit<DelegateDraft, "hash" | "network">): Uint8Array {
  return sha256(encodeDelegateAction(build(draft)))
}

/**
 * Server side: read the user's key nonce and the chain height, and produce the draft to sign.
 * Fails if the key is not a full-access key on the account.
 */
export async function draftDelegate(input: {
  network: NetworkId
  senderId: string
  receiverId: string
  publicKey: string
  calls: CallSpec[]
}): Promise<DelegateDraft> {
  const provider = nearProvider(input.network)
  const [accessKey, block] = await Promise.all([
    provider.viewAccessKey({ accountId: input.senderId, publicKey: input.publicKey }),
    provider.viewBlock({ finality: "final" }),
  ])
  const body = {
    senderId: input.senderId,
    receiverId: input.receiverId,
    publicKey: input.publicKey,
    calls: input.calls,
    nonce: (BigInt(accessKey.nonce) + 1n).toString(),
    maxBlockHeight: (BigInt(block.header.height) + BigInt(LIMITS.delegateTtlBlocks)).toString(),
  }
  return { network: input.network, ...body, hash: toHex(delegateHash(body)) }
}

/** Browser side: true when the draft really is the action the hash claims. */
export function draftMatchesHash(draft: DelegateDraft): boolean {
  return toHex(delegateHash(draft)) === draft.hash
}

/** The relayable action: the draft plus the user's 64-byte ed25519 signature. */
export function signedDelegateAction(draft: DelegateDraft, signature: Uint8Array): Action {
  const publicKey = PublicKey.fromString(draft.publicKey)
  return actions.signedDelegate({
    delegateAction: build(draft),
    signature: new Signature({ keyType: publicKey.keyType, data: signature }),
  })
}

/** Check a signature over the draft's hash before spending gas on it. */
export function verifyDraftSignature(draft: DelegateDraft, signature: Uint8Array): boolean {
  return PublicKey.fromString(draft.publicKey).verify(delegateHash(draft), signature)
}

export const signatureToBase64 = (signature: Uint8Array) => base64Encode(signature)
export const signatureFromBase64 = (value: string) => base64Decode(value)
