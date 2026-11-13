/**
 * Proof: signing in with a NEAR wallet and approving a gas-free action with it, on testnet (plan S08, spec 6.8 AA),
 * against the running app and worker.
 *
 *   tsx src/proofs/wallet.ts
 *
 * A real `name.testnet` account (not a Tegata one) plays the wallet: it signs "Sign in to Tegata" with the server's
 * nonce (NEP-413), exactly what NEAR Connect's `signInAndSignMessage` returns. The app checks it and starts a session.
 * The business opens with that account as its pay address; Tegata only registers it for USDC. Then a send is drafted
 * and the "wallet" signs it as its own delegate action (its own nonce, expiry and key, as `signDelegateActions`
 * does); Tegata checks it is exactly the draft and relays it, paying the fee. A replayed sign-in and a delegate for
 * another receiver are both refused.
 */
import { NETWORKS } from "@tegata/config"
import {
  createWalletAccount,
  newProofKey,
  randomHandle,
  walletSignsDelegate,
  walletSignsIn,
} from "@tegata/core/fixtures"
import { explorerTx, ftTransfer, nearBalance, Operator } from "@tegata/core/near"
import { loadDotEnv, operatorKeys, serverEnv } from "@tegata/env"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const env = serverEnv()
const operator = new Operator("testnet", operatorKeys("testnet", env))
const usdc = NETWORKS.testnet.usdc
const CENT = 10_000n
const ACCOUNT_DEPOSIT_YOCTO = 50_000_000_000_000_000_000_000n
const WAIT_TRIES = 60
const WAIT_MS = 2_000

let cookie = ""
async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<{ status: number; data: T }> {
  const response = await fetch(`${env.APP_URL}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const sessionCookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("tegata-session=") && !value.startsWith("tegata-session=;"))
  if (sessionCookie) cookie = sessionCookie.split(";")[0] ?? ""
  return { status: response.status, data: (await response.json()) as T }
}
const wait = () => new Promise((resolve) => setTimeout(resolve, WAIT_MS))

// The "wallet": a real top-level testnet account with its own key.
const key = newProofKey()
const { accountId, hash: createdHash } = await createWalletAccount(
  operator,
  randomHandle("tegata-wallet"),
  key,
  ACCOUNT_DEPOSIT_YOCTO,
)
console.log(`Wallet account ${accountId}: ${explorerTx("testnet", createdHash)}`)

// Sign in: the server's nonce, the wallet's NEP-413 signature.
const challenge = await api<{ nonce: string; message: string; recipient: string }>(
  "/api/wallet/challenge",
  { network: "testnet" },
)
const signed = await walletSignsIn(key, accountId, challenge.data.nonce)
const session = await api<{ user: { id: string; walletAccountId: string } }>(
  "/api/wallet/session",
  {
    network: "testnet",
    accountId,
    ...signed,
    nonce: challenge.data.nonce,
  },
)
console.log(
  `Signed in: ${session.status} as ${session.data.user?.walletAccountId}; session cookie ${cookie ? "set" : "MISSING"}`,
)
const replay = await api<{ error?: { message: string } }>("/api/wallet/session", {
  network: "testnet",
  accountId,
  ...signed,
  nonce: challenge.data.nonce,
})
console.log(`Same signature again: ${replay.status} "${replay.data.error?.message}"`)

// Open the business: the pay address is the wallet's own account.
await api("/api/onboard", { handle: "", businessName: "Wallet Proof Shop", timezone: "UTC" })
type Me = {
  user: { handle: string | null }
  accounts: {
    accountId: string
    readyAt: string | null
    createdTx: string | null
    registeredTx: string | null
  }[]
}
let me = (await api<Me>("/api/me")).data
for (let i = 0; i < WAIT_TRIES && !me.accounts[0]?.readyAt; i++) {
  await wait()
  me = (await api<Me>("/api/me")).data
}
const account = me.accounts[0]
console.log(
  `Business open: handle ${me.user.handle}, pay address ${account?.accountId}, created by Tegata: ${account?.createdTx ? "yes" : "no"}`,
)
if (account?.registeredTx)
  console.log(`Registered for USDC by Tegata: ${explorerTx("testnet", account.registeredTx)}`)

// Some test dollars, then a send the wallet approves as its own delegate action.
await operator.call(usdc, [ftTransfer(accountId, 10n * CENT, "tegata:test-dollars")])
const nearBefore = await nearBalance("testnet", accountId)
const send = await api<{ relayId: string; draft: Parameters<typeof walletSignsDelegate>[1] }>(
  "/api/sends",
  { network: "testnet", to: operator.accountId, amount: "0.05" },
)
const tampered = await walletSignsDelegate(key, send.data.draft, [
  ftTransfer(`${randomHandle("elsewhere")}.testnet`, 5n * CENT, "tegata:send"),
])
const refused = await api<{ error?: { message: string } }>("/api/relay/sign", {
  relayId: send.data.relayId,
  signedDelegate: tampered,
})
console.log(`A delegate for another receiver: ${refused.status} "${refused.data.error?.message}"`)
const approved = await api<{ status: string }>("/api/relay/sign", {
  relayId: send.data.relayId,
  signedDelegate: await walletSignsDelegate(key, send.data.draft),
})
console.log(`The wallet's own delegate for the draft: ${approved.status} ${approved.data.status}`)
let relay = { status: "signed", txHash: null as string | null, error: null as string | null }
for (let i = 0; i < WAIT_TRIES && !["success", "failed"].includes(relay.status); i++) {
  await wait()
  relay = (await api<typeof relay>(`/api/relay/${send.data.relayId}`)).data
}
const nearAfter = await nearBalance("testnet", accountId)
console.log(
  `Relayed by Tegata: ${relay.status}${relay.txHash ? ` ${explorerTx("testnet", relay.txHash)}` : ""}${relay.error ? ` (${relay.error})` : ""}`,
)
console.log(
  `The wallet's NEAR before and after: ${nearBefore} → ${nearAfter} yocto (Tegata paid the fee)`,
)
