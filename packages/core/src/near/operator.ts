import { NETWORKS, type NetworkId, TIMEOUTS } from "@tegata/config"
import {
  Account,
  type Action,
  actions,
  base64Decode,
  base64Encode,
  baseEncode,
  decodeSignedTransaction,
  encodeTransaction,
  KeyPairSigner,
  type KeyPairString,
  PublicKey,
  type SignedTransaction,
} from "near-api-js"

import { type CallSpec, toAction } from "./calls.ts"
import { nearProvider } from "./provider.ts"
import { storageDeposit } from "./usdc.ts"

/** What happened to a transaction the operator sent. */
export interface TxResult {
  hash: string
  /** `unknown` means it may still land: never sign a replacement, re-send the same bytes. */
  status: "success" | "failed" | "unknown"
  /** The first failure found in any receipt, in the chain's own words. */
  error?: string
  /** yoctoNEAR burnt for gas across all receipts, paid by the operator. */
  tokensBurnt: bigint
}

/** A transaction signed once. Persist `hash` and `bytes` before the first broadcast. */
export interface SignedTx {
  hash: string
  /** Base64 of the signed transaction: enough to re-send it after a crash. */
  bytes: string
  signed: SignedTransaction
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The operator account (`tegata.near` / `tegata.testnet`): pays gas for relayed actions,
 * creates user accounts and registers them on USDC. Each key signs one transaction at a
 * time, so parallel sends never collide on a nonce.
 */
export class Operator {
  readonly network: NetworkId
  readonly accountId: string
  private readonly slots: { signer: KeyPairSigner; busy: Promise<unknown> }[]
  private next = 0

  constructor(network: NetworkId, secretKeys: readonly string[], accountId?: string) {
    if (secretKeys.length === 0) throw new Error("The operator needs at least one key")
    this.network = network
    this.accountId = accountId ?? NETWORKS[network].operator
    this.slots = secretKeys.map((key) => ({
      signer: KeyPairSigner.fromSecretKey(key as KeyPairString),
      busy: Promise.resolve(),
    }))
  }

  get keyCount(): number {
    return this.slots.length
  }

  /** Run `work` with exclusive use of one key. Calls queue per key in round-robin order. */
  private withKey<T>(work: (signer: KeyPairSigner) => Promise<T>): Promise<T> {
    const slot = this.slots[this.next % this.slots.length]
    this.next += 1
    if (!slot) throw new Error("No operator key")
    const run = slot.busy.then(
      () => work(slot.signer),
      () => work(slot.signer),
    )
    slot.busy = run.catch(() => undefined)
    return run
  }

  /** Sign a transaction from the operator without sending it. */
  private async sign(
    signer: KeyPairSigner,
    receiverId: string,
    txActions: Action[],
  ): Promise<SignedTx> {
    const account = new Account(this.accountId, nearProvider(this.network), signer)
    const publicKey = await signer.getPublicKey()
    const transaction = await account.createTransaction({
      receiverId,
      actions: txActions,
      publicKey,
    })
    const { txHash, signedTransaction } = await signer.signTransaction(transaction)
    return {
      hash: baseEncode(txHash),
      bytes: base64Encode(encodeTransaction(signedTransaction)),
      signed: signedTransaction,
    }
  }

  /**
   * Send a signed transaction and wait for it to be final. A network error never triggers a
   * new signature: the same bytes are re-sent and the outcome is read by hash, so a relayed
   * action cannot run twice.
   */
  async broadcast(tx: SignedTx): Promise<TxResult> {
    const provider = nearProvider(this.network)
    const deadline = Date.now() + TIMEOUTS.relayFinalityMs
    let lastError: unknown
    while (Date.now() < deadline) {
      try {
        const outcome = await provider.sendTransactionUntil(tx.signed, "FINAL")
        return readOutcome(tx.hash, outcome)
      } catch (error) {
        lastError = error
        if (isRejected(error)) {
          return { hash: tx.hash, status: "failed", error: describe(error), tokensBurnt: 0n }
        }
      }
      try {
        const outcome = await provider.viewTransactionStatus({
          txHash: tx.hash,
          accountId: this.accountId,
          waitUntil: "FINAL",
        })
        return readOutcome(tx.hash, outcome)
      } catch (error) {
        lastError = error
      }
      await sleep(TIMEOUTS.relayPollMs)
    }
    return { hash: tx.hash, status: "unknown", error: describe(lastError), tokensBurnt: 0n }
  }

  /** Pick up a transaction that was signed before a crash: same bytes, same hash, no new signature. */
  resume(hash: string, bytes: string): Promise<TxResult> {
    return this.broadcast({ hash, bytes, signed: decodeSignedTransaction(base64Decode(bytes)) })
  }

  /** Sign, hand the hash to `onSigned` (to persist it), then broadcast. */
  async send(
    receiverId: string,
    txActions: Action[],
    onSigned?: (tx: SignedTx) => Promise<void> | void,
  ): Promise<TxResult> {
    return this.withKey(async (signer) => {
      const tx = await this.sign(signer, receiverId, txActions)
      await onSigned?.(tx)
      return this.broadcast(tx)
    })
  }

  /** Relay a user's signed delegate action. The receiver of the outer transaction is the user. */
  relay(
    senderId: string,
    signedDelegate: Action,
    onSigned?: (tx: SignedTx) => Promise<void> | void,
  ): Promise<TxResult> {
    return this.send(senderId, [signedDelegate], onSigned)
  }

  /** Call a contract as the operator (wrapping NEAR, registering accounts, running autopilot). */
  call(contractId: string, specs: CallSpec[]): Promise<TxResult> {
    return this.send(contractId, specs.map(toAction))
  }

  /**
   * Create `name.<operator>` with the user's key as its only full-access key. The account
   * starts with `dustYocto` NEAR; creation itself costs the operator about 0.007 NEAR.
   */
  createUserAccount(accountId: string, publicKey: string, dustYocto: bigint): Promise<TxResult> {
    return this.send(accountId, [
      actions.createAccount(),
      actions.transfer(dustYocto),
      actions.addFullAccessKey(PublicKey.fromString(publicKey)),
    ])
  }

  /** Register an account on USDC so it can receive dollars. */
  registerOnUsdc(accountId: string): Promise<TxResult> {
    return this.call(NETWORKS[this.network].usdc, [storageDeposit(accountId)])
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Errors that mean the chain refused the transaction outright, so it will never land. */
function isRejected(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /InvalidNonce|InvalidSignature|NotEnoughBalance|InvalidAccessKey|Expired|InvalidTransaction|DelegateActionExpired|DelegateActionInvalidNonce|AccessKeyNotFound/i.test(
    text,
  )
}

interface OutcomeLike {
  status?: unknown
  transaction_outcome?: { outcome?: { tokens_burnt?: string; status?: unknown } }
  receipts_outcome?: { outcome?: { tokens_burnt?: string; status?: unknown } }[]
}

/** Walk every receipt: the outer transaction can succeed while an inner receipt fails. */
function readOutcome(hash: string, raw: unknown): TxResult {
  const outcome = raw as OutcomeLike
  let tokensBurnt = BigInt(outcome.transaction_outcome?.outcome?.tokens_burnt ?? "0")
  let error: string | undefined
  for (const receipt of outcome.receipts_outcome ?? []) {
    tokensBurnt += BigInt(receipt.outcome?.tokens_burnt ?? "0")
    const failure = failureOf(receipt.outcome?.status)
    if (failure && !error) error = failure
  }
  const top = failureOf(outcome.status)
  if (top && !error) error = top
  return error
    ? { hash, status: "failed", error, tokensBurnt }
    : { hash, status: "success", tokensBurnt }
}

function failureOf(status: unknown): string | undefined {
  if (status && typeof status === "object" && "Failure" in status) {
    return JSON.stringify((status as { Failure: unknown }).Failure)
  }
  return undefined
}
