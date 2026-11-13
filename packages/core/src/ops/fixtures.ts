import { base64 } from "@scure/base"
import { GAS } from "@tegata/config"
import { actions, DelegateAction, encodeSignedDelegate, KeyPair, KeyPairSigner } from "near-api-js"

import {
  call,
  type DelegateDraft,
  delegateHash,
  ftTransfer,
  isRegistered,
  nearProvider,
  type Operator,
  SIGN_IN_MESSAGE,
  SIGN_IN_RECIPIENT,
  signedDelegateOf,
  storageDeposit,
  toAction,
  tokenBalance,
} from "../near/index.ts"

const HEX_RADIX = 16

export function randomHandle(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return `${prefix}-${Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(2, "0")).join("")}`
}

/** Create a user account holding `dust` yoctoNEAR, registered on `token` and holding `amount` of it. */
export async function fundedUser(operator: Operator, token: string, amount: bigint, dust: bigint) {
  const network = operator.network
  const pair = KeyPair.fromRandom("ed25519")
  const accountId = `${randomHandle("proof")}.${operator.accountId}`
  const created = await operator.createUserAccount(accountId, pair.getPublicKey().toString(), dust)
  if (created.status !== "success") throw new Error(`Account creation failed: ${created.error}`)

  if (!(await isRegistered(network, token, operator.accountId))) {
    await operator.call(token, [storageDeposit(operator.accountId)])
  }
  await operator.call(token, [storageDeposit(accountId)])
  if ((await tokenBalance(network, token, operator.accountId)) < amount) {
    const wrapped = await operator.call(token, [
      call("near_deposit", {}, GAS.nearDeposit, amount * 10n),
    ])
    if (wrapped.status !== "success") throw new Error(`Wrapping NEAR failed: ${wrapped.error}`)
  }
  const sent = await operator.call(token, [ftTransfer(accountId, amount)])
  if (sent.status !== "success") throw new Error(`Funding the user failed: ${sent.error}`)
  return { pair, accountId, creationBurnt: created.tokensBurnt }
}

/** A fresh ed25519 key for a proof account (its secret never leaves the proof run). */
export const newProofKey = () => KeyPair.fromRandom("ed25519")

// --- a NEAR wallet, simulated (the wallet proof) ---------------------------------------------------------------------

/** Create `name.testnet` (a top-level testnet name, not a Tegata account) with `key` as its full-access key. */
export async function createWalletAccount(
  operator: Operator,
  name: string,
  key: KeyPair,
  deposit: bigint,
): Promise<{ accountId: string; hash: string }> {
  const accountId = `${name}.testnet`
  const created = await operator.send("testnet", [
    actions.functionCall(
      "create_account",
      { new_account_id: accountId, new_public_key: key.getPublicKey().toString() },
      GAS.registrarCreateAccount,
      deposit,
    ),
  ])
  if (created.status !== "success")
    throw new Error(`Creating ${accountId} failed: ${created.error}`)
  return { accountId, hash: created.hash }
}

/** What a wallet returns for "Sign in to Tegata": its key and a base64 NEP-413 signature. */
export async function walletSignsIn(key: KeyPair, accountId: string, nonceBase64: string) {
  const signed = await new KeyPairSigner(key).signNep413Message(accountId, {
    message: SIGN_IN_MESSAGE,
    recipient: SIGN_IN_RECIPIENT,
    nonce: base64.decode(nonceBase64),
  })
  return { publicKey: signed.publicKey.toString(), signature: base64.encode(signed.signature) }
}

/**
 * What a wallet's `signDelegateActions` returns for a draft: the same action, but with the wallet's own nonce, expiry
 * and key, borsh-encoded and base64. `calls` lets a test sign something other than the draft.
 */
export async function walletSignsDelegate(
  key: KeyPair,
  draft: DelegateDraft,
  calls: DelegateDraft["calls"] = draft.calls,
): Promise<string> {
  const provider = nearProvider(draft.network)
  const publicKey = key.getPublicKey()
  const [accessKey, block] = await Promise.all([
    provider.viewAccessKey({ accountId: draft.senderId, publicKey: publicKey.toString() }),
    provider.viewBlock({ finality: "final" }),
  ])
  const body = {
    senderId: draft.senderId,
    receiverId: draft.receiverId,
    publicKey: publicKey.toString(),
    calls,
    nonce: (BigInt(accessKey.nonce) + 1n).toString(),
    maxBlockHeight: (BigInt(block.header.height) + WALLET_TTL_BLOCKS).toString(),
  }
  const { signature } = key.sign(delegateHash(body))
  return base64.encode(
    encodeSignedDelegate(
      signedDelegateOf(
        new DelegateAction({
          senderId: body.senderId,
          receiverId: body.receiverId,
          actions: calls.map(toAction),
          nonce: BigInt(body.nonce),
          maxBlockHeight: BigInt(body.maxBlockHeight),
          publicKey,
        }),
        signature,
      ),
    ),
  )
}

/** A wallet's own expiry, deliberately not the server draft's. */
const WALLET_TTL_BLOCKS = 150n
