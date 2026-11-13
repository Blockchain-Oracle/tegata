/**
 * Operator tooling, run with `pnpm ops <command>`.
 *
 *   pnpm ops status <network>            operator balance and key count
 *   pnpm ops add-keys <network> <count>  add full-access keys for parallel relays; writes .env
 *   pnpm ops register <network> <account> register an account on USDC so it can receive dollars
 *   pnpm ops proof-relay                 Proof 1: a 0-NEAR account moves tokens through the relayer
 *   pnpm ops proof-parallel              Proof 2: parallel relays never double-send
 *   pnpm ops pay-link <url> [dollars]    pay a Sandbox pay link from the operator, the way a NEAR wallet does
 *   pnpm ops deploy-autopilot testnet    create pay.tegata.testnet, deploy the autopilot contract, register it on USDC
 *   pnpm ops mainnet-address             the address to fund (an implicit account of Tegata's new mainnet key)
 *   pnpm ops create-operator             (run by Abu) create tegata.near from that funded address, with the same key
 *
 * Secret keys are read from and written to files only. They are never printed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

import { GAS, NETWORKS, type NetworkId, ONE_YOCTO, TGAS } from "@tegata/config"
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

const USDC_DECIMALS = 6
const FOLLOW_TRIES = 30
const FOLLOW_EVERY_MS = 2_000

/**
 * Pay a Sandbox pay link from the operator account exactly as a NEAR wallet does: start an attempt on the public
 * API, send one USDC `ft_transfer` carrying the attempt's memo, hand the hash back, then follow the attempt until
 * the app has read the transfer on NEAR and issued the receipt.
 */
async function payLink(target: string, dollars: string | undefined) {
  const network: NetworkId = "testnet"
  const url = new URL(target)
  const token = url.pathname.split("/pay/")[1]
  if (!token) throw new Error("Give the pay link's full URL, like http://localhost:3100/pay/abc123")
  const operator = new Operator(network, operatorKeys(network))
  const post = async <T>(path: string, body: unknown): Promise<T> => {
    const response = await fetch(`${url.origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await response.json()) as T & { error?: { message: string } }
    if (!response.ok) throw new Error(data.error?.message ?? `HTTP ${response.status}`)
    return data
  }

  const attempt = await post<{
    paymentId: string
    receiverId: string
    amount: string
    memo: string
  }>(`/api/pay/${token}/attempts`, {
    rail: "near_wallet",
    payer: operator.accountId,
    amount: dollars,
  })
  const amount = BigInt(attempt.amount)
  console.log(
    `Paying ${fromUnits(amount, USDC_DECIMALS)} USDC to ${attempt.receiverId} (memo ${attempt.memo})`,
  )
  const sent = await operator.call(NETWORKS[network].usdc, [
    ftTransfer(attempt.receiverId, amount, attempt.memo),
  ])
  console.log(`Transfer ${sent.status}: ${explorerTx(network, sent.hash)}`)
  if (sent.status !== "success") {
    process.exitCode = 1
    return
  }
  await post(`/api/pay/attempts/${attempt.paymentId}/tx`, {
    txHash: sent.hash,
    payer: operator.accountId,
  })
  for (let i = 0; i < FOLLOW_TRIES; i++) {
    const view = (await (
      await fetch(`${url.origin}/api/pay/attempts/${attempt.paymentId}`)
    ).json()) as { status: string; receiptToken: string | null; error: string | null }
    if (view.status !== "awaiting" && view.status !== "detected") {
      console.log(`Payment ${view.status}${view.error ? `: ${view.error}` : ""}`)
      if (view.receiptToken) console.log(`Receipt: ${url.origin}/r/${view.receiptToken}`)
      if (view.status !== "succeeded") process.exitCode = 1
      return
    }
    await new Promise((resolve) => setTimeout(resolve, FOLLOW_EVERY_MS))
  }
  console.log("NEAR is still being checked. Open the pay page to follow it.")
}

/** NEAR the autopilot account starts with: code storage (~1.87 NEAR for 187 KB) plus a float for 1-yocto deposits. */
const AUTOPILOT_FUNDING_YOCTO = 2_500_000_000_000_000_000_000_000n
const AUTOPILOT_INIT_GAS = 50n * TGAS
const YOCTO_PER_BYTE = 10_000_000_000_000_000_000n
const AUTOPILOT_WASM = join(ROOT, "contracts/target/near/tegata_autopilot/tegata_autopilot.wasm")

/**
 * Create the autopilot's account under the operator (its key is the operator's first key, so the operator can
 * redeploy during the hackathon, as the README says), deploy the contract and initialise it with USDC and the
 * operator as admin, then register it on USDC. Testnet only: mainnet is Abu's to run, after he sees the number.
 */
async function deployAutopilot(network: NetworkId) {
  const code = readFileSync(AUTOPILOT_WASM)
  const accountId = NETWORKS[network].autopilot
  const storage = BigInt(code.length) * YOCTO_PER_BYTE
  console.log(
    `Contract: ${code.length} bytes, code storage ${fromUnits(storage, NEAR_DECIMALS)} NEAR on either network`,
  )
  if (network !== "testnet") {
    console.log("Mainnet is run by Abu. Nothing was sent.")
    return
  }
  const keys = operatorKeys(network)
  const operator = new Operator(network, keys)
  if (!(await accountExists(network, accountId))) {
    const publicKey = KeyPair.fromString(keys[0] as `ed25519:${string}`).getPublicKey()
    const created = await operator.send(accountId, [
      actions.createAccount(),
      actions.transfer(AUTOPILOT_FUNDING_YOCTO),
      actions.addFullAccessKey(publicKey),
    ])
    console.log(`Created ${accountId}: ${created.status} ${explorerTx(network, created.hash)}`)
    if (created.status !== "success") {
      process.exitCode = 1
      return
    }
  }
  const self = new Operator(network, keys.slice(0, 1), accountId)
  const deployed = await self.send(accountId, [
    actions.deployContract(code),
    actions.functionCall(
      "new",
      { token: NETWORKS[network].usdc, admin: NETWORKS[network].operator },
      AUTOPILOT_INIT_GAS,
      0n,
    ),
  ])
  console.log(`Deployed and initialised: ${deployed.status} ${explorerTx(network, deployed.hash)}`)
  if (deployed.status !== "success") {
    process.exitCode = 1
    return
  }
  const registered = await operator.registerOnUsdc(accountId)
  console.log(`Registered on USDC: ${registered.status} ${explorerTx(network, registered.hash)}`)
  console.log(
    `${accountId} holds ${fromUnits(await nearBalance(network, accountId), NEAR_DECIMALS)} NEAR`,
  )
}

/** The mainnet operator key, made here and kept in .env only; tegata.near is created with it. */
const BOOTSTRAP_ENV = "MAINNET_OPERATOR_KEY"
/** NEAR kept on the implicit account for the create transaction's gas; everything else goes to tegata.near. */
const CREATE_RESERVE_YOCTO = 50_000_000_000_000_000_000_000n
const MIN_OPERATOR_YOCTO = 2_000_000_000_000_000_000_000_000n

function bootstrapKey(): KeyPair {
  const existing = readEnv().get(BOOTSTRAP_ENV)
  if (existing) return KeyPair.fromString(existing as `ed25519:${string}`)
  const key = KeyPair.fromRandom("ed25519")
  writeEnvValue(BOOTSTRAP_ENV, key.toString())
  return key
}

const implicitOf = (key: KeyPair) => Buffer.from(key.getPublicKey().data).toString("hex")

/** Print the address to send NEAR to. The secret key goes to .env and is never printed. */
async function mainnetAddress() {
  const key = bootstrapKey()
  const implicit = implicitOf(key)
  const funded = (await accountExists("mainnet", implicit))
    ? await nearBalance("mainnet", implicit)
    : 0n
  console.log(`Send NEAR to:   ${implicit}`)
  console.log(`(public key ${key.getPublicKey().toString()})`)
  console.log(`It holds:       ${near(funded)} NEAR`)
  console.log(
    `tegata.near:    ${(await accountExists("mainnet", NETWORKS.mainnet.operator)) ? "exists" : "free"}`,
  )
}

/**
 * Abu runs this: from the funded implicit account, ask the `near` registrar to create tegata.near with the same key
 * as its only full-access key, moving everything but a small gas reserve into it.
 */
async function createOperator() {
  const key = bootstrapKey()
  const implicit = implicitOf(key)
  const operatorId = NETWORKS.mainnet.operator
  if (await accountExists("mainnet", operatorId)) {
    console.log(`${operatorId} already exists. Nothing was sent.`)
    return
  }
  const balance = (await accountExists("mainnet", implicit))
    ? await nearBalance("mainnet", implicit)
    : 0n
  const deposit = balance - CREATE_RESERVE_YOCTO
  if (deposit < MIN_OPERATOR_YOCTO) {
    console.log(
      `${implicit} holds ${near(balance)} NEAR; send at least 2.1 NEAR first. Nothing was sent.`,
    )
    process.exitCode = 1
    return
  }
  console.log(
    `Creating ${operatorId} with ${near(deposit)} NEAR (keeping ${near(CREATE_RESERVE_YOCTO)} for gas)…`,
  )
  const funder = new Operator("mainnet", [key.toString()], implicit)
  const created = await funder.send(NETWORKS.mainnet.registrar, [
    actions.functionCall(
      "create_account",
      { new_account_id: operatorId, new_public_key: key.getPublicKey().toString() },
      GAS.registrarCreateAccount,
      deposit,
    ),
  ])
  console.log(`${created.status}: ${explorerTx("mainnet", created.hash)}`)
  if (created.status !== "success") {
    process.exitCode = 1
    return
  }
  console.log(`${operatorId} holds ${near(await nearBalance("mainnet", operatorId))} NEAR`)
}

const [command, ...args] = process.argv.slice(2)
try {
  if (command === "status") await status(parseNetwork(args[0]))
  else if (command === "add-keys") await addKeys(parseNetwork(args[0]), Number(args[1] ?? "3"))
  else if (command === "register") await register(parseNetwork(args[0]), args[1] ?? "")
  else if (command === "proof-relay") await proofRelay()
  else if (command === "proof-parallel") await proofParallel()
  else if (command === "pay-link") await payLink(args[0] ?? "", args[1])
  else if (command === "deploy-autopilot") await deployAutopilot(parseNetwork(args[0]))
  else if (command === "mainnet-address") await mainnetAddress()
  else if (command === "create-operator") await createOperator()
  else if (command === "exists")
    console.log(await accountExists(parseNetwork(args[0]), args[1] ?? ""))
  else {
    console.error(
      "Commands: status, add-keys, register, proof-relay, proof-parallel, pay-link, deploy-autopilot, mainnet-address, create-operator, exists",
    )
    process.exitCode = 2
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
