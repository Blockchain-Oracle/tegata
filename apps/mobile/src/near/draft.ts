// The phone's check on every money action before the key signs it. The server drafts a NEP-366 delegate action and
// sends it as JSON with the hash to sign; here it is re-encoded with borsh, byte for byte as near-api-js does it
// (`encodeDelegateAction`: the NEP-461 prefix, then the action), and hashed. A draft whose hash isn't the hash of what
// it says, or whose call isn't the one on screen, is refused. `scripts/check-draft.ts` proves parity with
// `@tegata/core/near` `delegateHash` on real drafts.
import { sha256 } from "@noble/hashes/sha2.js"
import { base58 } from "@scure/base"

export type NetworkId = "mainnet" | "testnet"

/** One contract call, as the server writes it (`@tegata/core/near` CallSpec). */
export interface CallSpec {
  method: string
  argsJson: string
  gas: string
  deposit: string
}

/** A gas-free action waiting for the person's signature (`@tegata/core/near` DelegateDraft). */
export interface DelegateDraft {
  network: NetworkId
  senderId: string
  receiverId: string
  publicKey: string
  calls: CallSpec[]
  nonce: string
  maxBlockHeight: string
  hash: string
}

/** NEP-461: 2^30 + 366, the delegate action's message prefix. */
const DELEGATE_PREFIX = 1_073_742_190
const FUNCTION_CALL = 2
const ED25519 = 0
const ED25519_KEY_BYTES = 32

class Writer {
  private bytes: number[] = []
  u8(value: number) {
    this.bytes.push(value & 0xff)
  }
  u32(value: number) {
    for (let i = 0; i < 4; i++) this.bytes.push((value >>> (8 * i)) & 0xff)
  }
  /** Little-endian unsigned integer of `size` bytes from a bigint. */
  uint(value: bigint, size: number) {
    if (value < 0n) throw new Error("Negative integer in a draft")
    let rest = value
    for (let i = 0; i < size; i++) {
      this.bytes.push(Number(rest & 0xffn))
      rest >>= 8n
    }
    if (rest !== 0n) throw new Error("Integer too large in a draft")
  }
  raw(data: Uint8Array) {
    for (const byte of data) this.bytes.push(byte)
  }
  /** borsh Vec<u8> and String: a u32 length, then the bytes. */
  vec(data: Uint8Array) {
    this.u32(data.length)
    this.raw(data)
  }
  out() {
    return Uint8Array.from(this.bytes)
  }
}

const utf8 = (text: string) => new TextEncoder().encode(text)

function publicKeyBytes(key: string): Uint8Array {
  const [type, data] = key.split(":")
  if (type !== "ed25519" || !data) throw new Error("Only ed25519 keys sign Tegata actions")
  const bytes = base58.decode(data)
  if (bytes.length !== ED25519_KEY_BYTES) throw new Error("A NEAR key is 32 bytes")
  return bytes
}

/** The bytes a NEAR signer signs over (before hashing): prefix, then the borsh delegate action. */
export function encodeDraft(draft: Omit<DelegateDraft, "hash" | "network">): Uint8Array {
  const w = new Writer()
  w.u32(DELEGATE_PREFIX)
  w.vec(utf8(draft.senderId))
  w.vec(utf8(draft.receiverId))
  w.u32(draft.calls.length)
  for (const call of draft.calls) {
    w.u8(FUNCTION_CALL)
    w.vec(utf8(call.method))
    w.vec(utf8(call.argsJson))
    w.uint(BigInt(call.gas), 8)
    w.uint(BigInt(call.deposit), 16)
  }
  w.uint(BigInt(draft.nonce), 8)
  w.uint(BigInt(draft.maxBlockHeight), 8)
  w.u8(ED25519)
  w.raw(publicKeyBytes(draft.publicKey))
  return w.out()
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

/** Hex SHA-256 of the encoded delegate action: the 32 bytes the person's key signs. */
export function draftHash(draft: Omit<DelegateDraft, "hash" | "network">): string {
  return toHex(sha256(encodeDraft(draft)))
}

/** True when the draft really is the action its hash claims. */
export function draftMatchesHash(draft: DelegateDraft): boolean {
  try {
    return draftHash(draft) === draft.hash
  } catch {
    return false
  }
}

export class DraftMismatch extends Error {
  constructor() {
    super("The action to approve doesn't match what you reviewed")
  }
}

interface FtTransfer {
  receiver_id?: string
  amount?: string
  memo?: string
}

/** Every call's `ft_transfer` arguments, after checking the hash and that each call is an `ft_transfer`. */
export function ftTransfers(draft: DelegateDraft, usdc: string): FtTransfer[] {
  if (!draftMatchesHash(draft) || draft.receiverId !== usdc) throw new DraftMismatch()
  return draft.calls.map((call) => {
    if (call.method !== "ft_transfer") throw new DraftMismatch()
    return JSON.parse(call.argsJson) as FtTransfer
  })
}

/** A one-off send: exactly one USDC transfer of `amount` base units to `to`. */
export function checkSend(draft: DelegateDraft, expected: { usdc: string; to: string; amount: string }) {
  const transfers = ftTransfers(draft, expected.usdc)
  const [only] = transfers
  if (transfers.length !== 1 || only?.receiver_id !== expected.to || only.amount !== expected.amount)
    throw new DraftMismatch()
}
