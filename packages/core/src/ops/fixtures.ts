import { GAS } from "@tegata/config"
import { KeyPair } from "near-api-js"

import {
  call,
  ftTransfer,
  isRegistered,
  type Operator,
  storageDeposit,
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
