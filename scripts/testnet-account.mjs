#!/usr/bin/env node
/**
 * Create a NEAR **testnet** account funded by NEAR's faucet (free test NEAR),
 * and keep its key in the standard keychain ~/.near-credentials/testnet/.
 * The private key is written to that file only (mode 600) and never printed.
 *
 *   node contracts/scripts/testnet-account.mjs mamori.testnet
 *
 * Same faucet service near-cli uses for `create-account --useFaucet`.
 */
import { generateKeyPairSync } from "node:crypto"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const FAUCET = "https://helper.nearprotocol.com/account"
const RPC = "https://rpc.testnet.near.org"

const accountId = process.argv[2]
if (!accountId || !/^[a-z0-9][a-z0-9_-]{1,40}\.testnet$/.test(accountId)) {
  console.error("usage: node contracts/scripts/testnet-account.mjs <name>.testnet")
  process.exit(2)
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
function base58(bytes) {
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`)
  let out = ""
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out
    n /= 58n
  }
  for (const b of bytes) {
    if (b !== 0) break
    out = `1${out}`
  }
  return out
}

async function view(account) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "query",
      params: { request_type: "view_account", finality: "final", account_id: account },
    }),
  })
  return (await response.json()).result ?? null
}

const dir = join(homedir(), ".near-credentials", "testnet")
const file = join(dir, `${accountId}.json`)
if (existsSync(file)) {
  console.error(`${file} already exists; not overwriting it.`)
  process.exit(1)
}
if (await view(accountId)) {
  console.error(`${accountId} already exists on testnet. Pick another name.`)
  process.exit(1)
}

// ed25519 key pair: NEAR's secret key is the 32-byte seed followed by the public key.
const { publicKey, privateKey } = generateKeyPairSync("ed25519")
const pub = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url")
const seed = Buffer.from(privateKey.export({ format: "jwk" }).d, "base64url")
const publicKeyString = `ed25519:${base58(pub)}`

const response = await fetch(FAUCET, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ newAccountId: accountId, newAccountPublicKey: publicKeyString }),
})
if (!response.ok) {
  console.error(`The faucet refused (${response.status}): ${(await response.text()).slice(0, 300)}`)
  process.exit(1)
}

mkdirSync(dir, { recursive: true, mode: 0o700 })
writeFileSync(
  file,
  JSON.stringify({
    account_id: accountId,
    public_key: publicKeyString,
    private_key: `ed25519:${base58(Buffer.concat([seed, pub]))}`,
  }),
  { mode: 0o600 },
)

for (let i = 0; i < 10; i++) {
  const account = await view(accountId)
  if (account) {
    const near = Number(BigInt(account.amount) / 10n ** 21n) / 1000
    console.log(`Created ${accountId} with ${near} test NEAR.`)
    console.log(`Public key ${publicKeyString}; secret key saved to ${file} (mode 600).`)
    process.exit(0)
  }
  await new Promise((resolve) => setTimeout(resolve, 2000))
}
console.error("The faucet answered, but the account hasn't appeared yet. Check again in a minute.")
