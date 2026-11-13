/**
 * A demo business with real activity on testnet, made only through the app's own API (signed in as a NEAR wallet), so
 * every screen can be walked and captured with real data. Run with the app and the worker running:
 *
 *   tsx src/proofs/demo.ts <session-file>
 *
 * Studio Kaze: a paid pay link, an invoice paid in part, a customer, two people paid in one payroll run, a send, an API
 * key with Tegata's test inbox and a paid checkout session, and a counter sale. Customers pay from their own NEAR
 * accounts the way a NEAR wallet does. The wallet key and session cookie go to <session-file> (keep it out of git).
 */
import { writeFileSync } from "node:fs"

import { NETWORKS } from "@tegata/config"
import {
  createWalletAccount,
  newProofKey,
  randomHandle,
  walletSignsDelegate,
  walletSignsIn,
} from "@tegata/core/fixtures"
import { ftTransfer, Operator } from "@tegata/core/near"
import { loadDotEnv, operatorKeys, serverEnv } from "@tegata/env"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const env = serverEnv()
const operator = new Operator("testnet", operatorKeys("testnet", env))
const usdc = NETWORKS.testnet.usdc
const CENT = 10_000n
const DEPOSIT_YOCTO = 50_000_000_000_000_000_000_000n
const CUSTOMER_GAS_YOCTO = 50_000_000_000_000_000_000_000n
const WAIT_TRIES = 90
const WAIT_MS = 2_000
const sessionFile = process.argv[2]
if (!sessionFile) throw new Error("Usage: tsx src/proofs/demo.ts <session-file>")

let cookie = ""
async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const response = await fetch(`${env.APP_URL}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const set = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("tegata-session=") && !value.startsWith("tegata-session=;"))
  if (set) cookie = set.split(";")[0] ?? ""
  const data = (await response.json()) as T & { error?: { message: string } }
  if (!response.ok) throw new Error(`${path}: ${data.error?.message ?? response.status}`)
  return data
}
const wait = () => new Promise((resolve) => setTimeout(resolve, WAIT_MS))
async function until<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  let value = await read()
  for (let i = 0; i < WAIT_TRIES && !done(value); i++) {
    await wait()
    value = await read()
  }
  return value
}

// The owner: a NEAR wallet account.
const key = newProofKey()
const { accountId } = await createWalletAccount(
  operator,
  randomHandle("studio-kaze"),
  key,
  DEPOSIT_YOCTO,
)
const challenge = await api<{ nonce: string }>("/api/wallet/challenge", { network: "testnet" })
await api("/api/wallet/session", {
  network: "testnet",
  accountId,
  ...(await walletSignsIn(key, accountId, challenge.nonce)),
  nonce: challenge.nonce,
})
await api("/api/onboard", { handle: "", businessName: "Studio Kaze", timezone: "Europe/London" })
type Me = { accounts: { readyAt: string | null }[] }
await until(
  () => api<Me>("/api/me"),
  (me) => Boolean(me.accounts[0]?.readyAt),
)
await api(
  "/api/business",
  { name: "Studio Kaze", address: "14 Kanda Lane\nLondon E2 7DG", timezone: "Europe/London" },
  "PATCH",
)
await operator.call(usdc, [ftTransfer(accountId, 100n * CENT, "tegata:test-dollars")])
console.log(`Owner ${accountId}: business open, $1.00 in test dollars`)

/** Approve drafts the way the wallet does, then wait for the relays to land. */
async function approve(
  relays: { relayId: string; draft: Parameters<typeof walletSignsDelegate>[1] }[],
) {
  const out = []
  for (const relay of relays)
    out.push({
      relayId: relay.relayId,
      signedDelegate: await walletSignsDelegate(key, relay.draft),
    })
  return out
}
async function landed(relayId: string) {
  return until(
    () => api<{ status: string; txHash: string | null }>(`/api/relay/${relayId}`),
    (r) => ["success", "failed"].includes(r.status),
  )
}

// A customer with their own NEAR account, paying the way a NEAR wallet does.
const customerKey = newProofKey()
const customerId = `${randomHandle("northwind")}.${operator.accountId}`
await operator.createUserAccount(
  customerId,
  customerKey.getPublicKey().toString(),
  CUSTOMER_GAS_YOCTO,
)
await operator.registerOnUsdc(customerId)
await operator.call(usdc, [ftTransfer(customerId, 50n * CENT, "tegata:test-dollars")])
const customer = new Operator("testnet", [customerKey.toString()], customerId)
async function customerPays(token: string, amount?: string) {
  const attempt = await api<{
    paymentId: string
    receiverId: string
    amount: string
    memo: string
  }>(`/api/pay/${token}/attempts`, {
    rail: "near_wallet",
    payer: customerId,
    ...(amount ? { amount } : {}),
  })
  const paid = await customer.call(usdc, [
    ftTransfer(attempt.receiverId, BigInt(attempt.amount), attempt.memo),
  ])
  await api(`/api/pay/attempts/${attempt.paymentId}/tx`, { txHash: paid.hash, payer: customerId })
  await until(
    () => api<{ status: string }>(`/api/pay/attempts/${attempt.paymentId}`),
    (a) => a.status === "succeeded" || a.status === "failed",
  ).catch(() => undefined)
  return paid.hash
}

// A pay link, paid.
const { link } = await api<{ link: { id: string; token: string } }>("/api/links", {
  title: "Design sprint · Week 2",
  amount: "0.25",
  note: "Thanks for the sprint!",
})
console.log(`Pay link paid: ${await customerPays(link.token)}`)

// An invoice to a customer, paid in part.
const { customer: northwind } = await api<{ customer: { id: string } }>("/api/customers", {
  name: "Northwind Ltd",
  email: null,
  address: "200 Market Street\nManchester M1 1AA",
})
const today = new Date().toISOString().slice(0, 10)
const due = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
const { invoice } = await api<{ invoice: { id: string } }>("/api/invoices", {
  customerId: northwind.id,
  issueDate: today,
  dueDate: due,
  notes: "Thank you for your business.",
  taxRate: "0",
  allowPartial: true,
  reminders: true,
  lines: [
    { description: "Brand workshop", quantity: "1", unitPrice: "0.20" },
    { description: "Logo revisions", quantity: "2", unitPrice: "0.05" },
  ],
})
const sent = await api<{ token: string }>(`/api/invoices/${invoice.id}/send`, {})
console.log(`Invoice sent and part-paid: ${await customerPays(sent.token, "0.15")}`)

// Two people with their own NEAR accounts, and one payroll run that pays both.
const team = []
for (const [name, role] of [
  ["Mei Tanaka", "Designer"],
  ["Kofi Mensah", "Developer"],
] as const) {
  const personKey = newProofKey()
  const personAccount = `${randomHandle(name.split(" ")[0]?.toLowerCase() ?? "p")}.${operator.accountId}`
  await operator.createUserAccount(personAccount, personKey.getPublicKey().toString(), 0n)
  await operator.registerOnUsdc(personAccount)
  const person = await api<{ id: string }>("/api/people", { name, role, amount: "0.10" })
  await api(`/api/people/${person.id}/destination`, { accountId: personAccount }, "PUT")
  team.push(person.id)
}
await until(
  () => api<{ people: { ready: boolean }[] }>("/api/people"),
  (r) => r.people.length === team.length && r.people.every((p) => p.ready),
).catch(() => undefined)
await api("/api/payroll", { cadence: "monthly", nextPayday: today }, "PUT")
const { runId } = await api<{ runId: string }>("/api/payroll/runs", {})
const prepared = await api<{
  batches: { relayId: string; draft: Parameters<typeof walletSignsDelegate>[1] }[]
}>(`/api/payroll/runs/${runId}/prepare`, {})
await api(`/api/payroll/runs/${runId}/approve`, { signatures: await approve(prepared.batches) })
for (const batch of prepared.batches)
  console.log(`Payroll run: ${(await landed(batch.relayId)).txHash}`)

// A send.
const send = await api<{ relayId: string; draft: Parameters<typeof walletSignsDelegate>[1] }>(
  "/api/sends",
  { network: "testnet", to: operator.accountId, amount: "0.05", note: "studio-rent" },
)
const [sendApproval] = await approve([send])
await api("/api/relay/sign", sendApproval)
console.log(`Send: ${(await landed(send.relayId)).txHash}`)

// Developers: an API key, Tegata's test inbox, and a checkout session a customer pays.
const { key: apiKey } = await api<{ key: string }>("/api/developers/keys", { name: "Shop server" })
await api("/api/developers/endpoints", { inbox: true })
const session = await fetch(`${env.APP_URL}/api/v1/checkout/sessions`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${apiKey}`,
    "idempotency-key": "order-1042",
    "content-type": "application/json",
  },
  body: JSON.stringify({ amount: "0.10", description: "Order #1042", metadata: { order: "1042" } }),
}).then((r) => r.json() as Promise<{ url: string }>)
console.log(`Checkout session paid: ${await customerPays(session.url.split("/pay/")[1] ?? "")}`)

// A counter sale, waiting to be paid.
await api("/api/counter", { amount: "0.12", note: "Two flat whites" })
console.log("Counter sale: open")

writeFileSync(
  sessionFile,
  JSON.stringify({ accountId, key: key.toString(), cookie, appUrl: env.APP_URL }, null, 2),
)
console.log(`Session for captures written to ${sessionFile}`)
