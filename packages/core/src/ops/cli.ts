/**
 * Operator tooling, run with `pnpm ops <command>`.
 *
 *   pnpm ops status <network>            operator balance and key count
 *   pnpm ops add-keys <network> <count>  add full-access keys for parallel relays; writes .env
 *   pnpm ops register <network> <account> register an account on USDC so it can receive dollars
 *   pnpm ops proof-relay                 Proof 1: a 0-NEAR account moves tokens through the relayer
 *   pnpm ops proof-parallel              Proof 2: parallel relays never double-send
 *
 * Secret keys are read from and written to files only. They are never printed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

import { NETWORKS, type NetworkId, ONE_YOCTO, TGAS } from "@tegata/config"
import { actions, KeyPair } from "near-api-js"

import { fromUnits } from "../money/index.ts"
import {
  accountExists,
  call,
  draftDelegate,
  draftMatchesHash,
  explorerTx,
  ftTransfer,
  nearBalance,
  nearProvider,
  Operator,
  signedDelegateAction,
  tokenBalance,
  verifyDraftSignature,
} from "../near/index.ts"
import { fundedUser } from "./fixtures.ts"

const ROOT = resolve(import.meta.dirname, "../../../..")
const ENV_FILE = join(ROOT, ".env")
const NEAR_DECIMALS = 24
const MS_PER_SECOND = 1000

function envName(network: NetworkId): string {
  return `OPERATOR_KEYS_${network.toUpperCase()}`
}

function readEnv(): Map<string, string> {
  const values = new Map<string, string>()
  if (!existsSync(ENV_FILE)) return values
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match?.[1]) values.set(match[1], match[2] ?? "")
  }
  return values
}

function writeEnvValue(name: string, value: string): void {
  const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8").split("\n") : []
  const index = lines.findIndex((line) => line.startsWith(`${name}=`))
  if (index >= 0) lines[index] = `${name}=${value}`
  else lines.push(`${name}=${value}`)
  writeFileSync(
    ENV_FILE,
    `${lines.filter((line, i) => line !== "" || i < lines.length - 1).join("\n")}\n`,
    {
      mode: 0o600,
    },
  )
}

/** Operator keys: from .env, falling back to the keychain file the account was created with. */
function operatorKeys(network: NetworkId): string[] {
  const fromEnv = readEnv().get(envName(network))
  if (fromEnv) return fromEnv.split(",").filter(Boolean)
  const file = join(homedir(), ".near-credentials", network, `${NETWORKS[network].operator}.json`)
  if (!existsSync(file)) {
    throw new Error(`No operator key: set ${envName(network)} in .env or create ${file}`)
  }
  const { private_key: key } = JSON.parse(readFileSync(file, "utf8")) as { private_key: string }
  return [key]
}

function parseNetwork(value: string | undefined): NetworkId {
  if (value === "mainnet" || value === "testnet") return value
  throw new Error("Give a network: testnet or mainnet")
}

const near = (yocto: bigint) => fromUnits(yocto, NEAR_DECIMALS)

async function status(network: NetworkId) {
  const { operator } = NETWORKS[network]
  const keys = await nearProvider(network).viewAccessKeyList({ accountId: operator })
  console.log(
    `${operator}: ${near(await nearBalance(network, operator))} NEAR, ${keys.keys.length} keys on chain`,
  )
  console.log(`${operatorKeys(network).length} keys available to this machine`)
}

async function addKeys(network: NetworkId, count: number) {
  const existing = operatorKeys(network)
  const operator = new Operator(network, existing)
  const fresh = Array.from({ length: count }, () => KeyPair.fromRandom("ed25519"))
  const result = await operator.send(
    operator.accountId,
    fresh.map((pair) => actions.addFullAccessKey(pair.getPublicKey())),
  )
  if (result.status !== "success") throw new Error(`Adding keys failed: ${result.error}`)
  writeEnvValue(envName(network), [...existing, ...fresh.map((pair) => pair.toString())].join(","))
  console.log(
    `Added ${count} keys to ${operator.accountId}. ${existing.length + count} keys saved to .env.`,
  )
  console.log(explorerTx(network, result.hash))
}

const PROOF_AMOUNT = 10n ** 22n // 0.01 wNEAR
const PROOF_SEND = 10n ** 21n // 0.001 wNEAR

/** Proof 1: who pays the fee and the 1 yoctoNEAR when a 0-NEAR account relays `ft_transfer`? */
async function proofRelay() {
  const network: NetworkId = "testnet"
  const operator = new Operator(network, operatorKeys(network))
  const token = NETWORKS[network].wnear
  console.log(`Token for the proof: ${token} (a NEP-141 token, same mechanics as USDC)`)

  const user = await fundedUser(operator, token, PROOF_AMOUNT, 0n)
  console.log(
    `User ${user.accountId} created. Creation cost the operator ${near(user.creationBurnt)} NEAR.`,
  )

  const userNearBefore = await nearBalance(network, user.accountId)
  const operatorNearBefore = await nearBalance(network, operator.accountId)
  const operatorTokenBefore = await tokenBalance(network, token, operator.accountId)

  // Server: build the action list and the draft to sign.
  const draft = await draftDelegate({
    network,
    senderId: user.accountId,
    receiverId: token,
    publicKey: user.pair.getPublicKey().toString(),
    calls: [ftTransfer(operator.accountId, PROOF_SEND, "tegata:proof")],
  })
  // Browser: rebuild, compare, sign the 32-byte hash (Privy's signRawHash does this step in the app).
  if (!draftMatchesHash(draft)) throw new Error("The draft does not match its hash")
  const { signature } = user.pair.sign(Uint8Array.from(Buffer.from(draft.hash, "hex")))
  // Server: verify, then relay.
  if (!verifyDraftSignature(draft, signature)) throw new Error("Bad signature")
  const result = await operator.relay(user.accountId, signedDelegateAction(draft, signature))

  const userNearAfter = await nearBalance(network, user.accountId)
  const operatorNearAfter = await nearBalance(network, operator.accountId)
  const operatorTokenAfter = await tokenBalance(network, token, operator.accountId)

  console.log(`\nRelay: ${result.status}${result.error ? ` (${result.error})` : ""}`)
  console.log(explorerTx(network, result.hash))
  console.log(`User NEAR before ${userNearBefore} yocto, after ${userNearAfter} yocto`)
  console.log(`Operator NEAR spent on the relay: ${near(operatorNearBefore - operatorNearAfter)}`)
  console.log(`Gas burnt across receipts: ${near(result.tokensBurnt)} NEAR`)
  console.log(
    `Tokens received by operator: ${fromUnits(operatorTokenAfter - operatorTokenBefore, NEAR_DECIMALS)}`,
  )
  if (result.status !== "success") process.exitCode = 1
}

const PARALLEL_USERS = 4
const RELAYS_PER_USER = 5

/** Proof 2: several users relay at the same time over several operator keys; each lands exactly once. */
async function proofParallel() {
  const network: NetworkId = "testnet"
  const operator = new Operator(network, operatorKeys(network))
  if (operator.keyCount < 2) throw new Error("Run `pnpm ops add-keys testnet 3` first")
  const token = NETWORKS[network].wnear
  const users = []
  for (let i = 0; i < PARALLEL_USERS; i++) {
    users.push(await fundedUser(operator, token, PROOF_AMOUNT, 0n))
  }
  const before = await tokenBalance(network, token, operator.accountId)
  const started = Date.now()

  // A user's key has one delegate nonce at a time, so each user's relays run in sequence.
  // The users run at the same time, which is what exercises the operator's key rotation.
  const perUser = await Promise.all(
    users.map(async (user) => {
      const results = []
      for (let i = 0; i < RELAYS_PER_USER; i++) {
        const draft = await draftDelegate({
          network,
          senderId: user.accountId,
          receiverId: token,
          publicKey: user.pair.getPublicKey().toString(),
          calls: [
            call(
              "ft_transfer",
              { receiver_id: operator.accountId, amount: "1" },
              10n * TGAS,
              ONE_YOCTO,
            ),
          ],
        })
        const { signature } = user.pair.sign(Uint8Array.from(Buffer.from(draft.hash, "hex")))
        results.push(await operator.relay(user.accountId, signedDelegateAction(draft, signature)))
      }
      return results
    }),
  )
  const results = perUser.flat()
  const after = await tokenBalance(network, token, operator.accountId)
  const ok = results.filter((result) => result.status === "success").length
  const hashes = new Set(results.map((result) => result.hash))
  const seconds = Math.round((Date.now() - started) / MS_PER_SECOND)
  console.log(
    `${ok}/${results.length} relays succeeded over ${operator.keyCount} keys in ${seconds}s`,
  )
  console.log(`${hashes.size} distinct transactions`)
  console.log(`Operator received ${after - before} units (expected ${ok})`)
  for (const failed of results.filter((result) => result.status !== "success")) {
    console.log(`  ${failed.status}: ${failed.error}`)
  }
  if (after - before !== BigInt(ok) || ok !== results.length) process.exitCode = 1
}

async function register(network: NetworkId, accountId: string) {
  const operator = new Operator(network, operatorKeys(network))
  const result = await operator.registerOnUsdc(accountId)
  console.log(`${accountId} on USDC: ${result.status}${result.error ? ` (${result.error})` : ""}`)
  console.log(explorerTx(network, result.hash))
}

const [command, ...args] = process.argv.slice(2)
try {
  if (command === "status") await status(parseNetwork(args[0]))
  else if (command === "add-keys") await addKeys(parseNetwork(args[0]), Number(args[1] ?? "3"))
  else if (command === "register") await register(parseNetwork(args[0]), args[1] ?? "")
  else if (command === "proof-relay") await proofRelay()
  else if (command === "proof-parallel") await proofParallel()
  else if (command === "exists")
    console.log(await accountExists(parseNetwork(args[0]), args[1] ?? ""))
  else {
    console.error("Commands: status, add-keys, register, proof-relay, proof-parallel, exists")
    process.exitCode = 2
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
