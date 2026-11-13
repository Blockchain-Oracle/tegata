/**
 * Proof: the developer API end to end on testnet (plan S07 "done when"), against the running app and worker.
 *
 *   tsx src/proofs/developers.ts
 *
 * A proof business gets an API key and Tegata's test inbox as its webhook endpoint. A real `curl` (the docs' own
 * command) creates a checkout session; a customer with its own NEAR account pays it the way a NEAR wallet does; the
 * worker reads the payment from NEAR, raises `checkout.session.completed`, signs it with Standard Webhooks and posts it
 * to the inbox, which checks the signature. A second curl reads the session back as complete.
 */
import { execFileSync } from "node:child_process"

import { NETWORKS } from "@tegata/config"
import { newProofKey, randomHandle } from "@tegata/core/fixtures"
import { explorerTx, ftTransfer, Operator } from "@tegata/core/near"
import { createDb, schema } from "@tegata/db"
import { loadDotEnv, operatorKeys, serverEnv } from "@tegata/env"
import { and, eq } from "drizzle-orm"

import { createApiKey, createEndpoint } from "../developers.ts"
import { onboard, setupAccount } from "../users.ts"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const env = serverEnv()
const { db, sql } = createDb(env.DATABASE_URL)
const operator = new Operator("testnet", operatorKeys("testnet", env))
const usdc = NETWORKS.testnet.usdc
const CENT = 10_000n
const CUSTOMER_GAS_YOCTO = 50_000_000_000_000_000_000_000n
const WAIT_TRIES = 60
const WAIT_MS = 2_000

const handle = randomHandle("dev")
const key = newProofKey()
const [user] = await db
  .insert(schema.users)
  .values({ email: `${handle}@proof.tegata.test`, publicKey: key.getPublicKey().toString() })
  .returning()
if (!user) throw new Error("no user")
const opened = await onboard(db, {
  userId: user.id,
  handle,
  businessName: "Proof Dev Shop",
  timezone: "UTC",
  networks: ["testnet"],
})
for (const account of opened.accounts) await setupAccount(db, operator, account.id)
const workspaceId = opened.workspace?.id ?? ""

const { key: apiKey } = await createApiKey(db, {
  workspaceId,
  network: "testnet",
  name: "Proof server",
})
const inbox = await createEndpoint(db, {
  workspaceId,
  network: "testnet",
  inbox: true,
  appUrl: env.APP_URL,
  allowLocal: true,
})
console.log(
  `Business ${handle}.tegata.testnet; API key ${apiKey.slice(0, 12)}…; inbox ${inbox.url}`,
)

const curl = (args: string[]) =>
  JSON.parse(execFileSync("curl", ["-s", ...args], { encoding: "utf8" })) as Record<string, unknown>
const session = curl([
  `${env.APP_URL}/api/v1/checkout/sessions`,
  "-H",
  `Authorization: Bearer ${apiKey}`,
  "-H",
  "Idempotency-Key: order-1042",
  "-H",
  "Content-Type: application/json",
  "-d",
  JSON.stringify({
    amount: "0.25",
    description: "Order #1042",
    success_url: "https://shop.example/thanks",
    metadata: { order: "1042" },
  }),
])
console.log(
  `curl → session ${session.id}: ${session.status}, ${session.amount} USD, ${session.url}`,
)
const again = curl([
  `${env.APP_URL}/api/v1/checkout/sessions`,
  "-H",
  `Authorization: Bearer ${apiKey}`,
  "-H",
  "Idempotency-Key: order-1042",
  "-H",
  "Content-Type: application/json",
  "-d",
  JSON.stringify({ amount: "0.25", description: "Order #1042" }),
])
console.log(`Same Idempotency-Key → same session: ${again.id === session.id}`)

// A customer pays the session's page from its own NEAR account.
const token = String(session.url).split("/pay/")[1] ?? ""
const customerKey = newProofKey()
const customerId = `${randomHandle("customer")}.${operator.accountId}`
await operator.createUserAccount(
  customerId,
  customerKey.getPublicKey().toString(),
  CUSTOMER_GAS_YOCTO,
)
await operator.registerOnUsdc(customerId)
await operator.call(usdc, [ftTransfer(customerId, 25n * CENT, "tegata:test-dollars")])
const post = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${env.APP_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await response.json()) as T & { error?: { message: string } }
  if (!response.ok) throw new Error(data.error?.message ?? `HTTP ${response.status}`)
  return data
}
const attempt = await post<{ paymentId: string; receiverId: string; amount: string; memo: string }>(
  `/api/pay/${token}/attempts`,
  { rail: "near_wallet", payer: customerId },
)
const customer = new Operator("testnet", [customerKey.toString()], customerId)
const paid = await customer.call(usdc, [
  ftTransfer(attempt.receiverId, BigInt(attempt.amount), attempt.memo),
])
console.log(`Customer paid 0.25: ${explorerTx("testnet", paid.hash)}`)
await post(`/api/pay/attempts/${attempt.paymentId}/tx`, { txHash: paid.hash, payer: customerId })

// Wait for the signed webhook to arrive at the inbox.
let arrived: (typeof schema.webhookInbox.$inferSelect)[] = []
for (
  let i = 0;
  i < WAIT_TRIES && !arrived.some((m) => m.type === "checkout.session.completed");
  i++
) {
  await new Promise((r) => setTimeout(r, WAIT_MS))
  arrived = await db
    .select()
    .from(schema.webhookInbox)
    .where(eq(schema.webhookInbox.endpointId, inbox.id))
}
for (const m of arrived)
  console.log(`Inbox received ${m.type}: signature ${m.verified ? "valid" : "INVALID"}`)
const deliveries = await db
  .select()
  .from(schema.webhookDeliveries)
  .where(and(eq(schema.webhookDeliveries.endpointId, inbox.id)))
console.log(`Deliveries: ${deliveries.map((d) => `${d.status} (${d.lastStatus})`).join(", ")}`)
const read = curl([
  `${env.APP_URL}/api/v1/checkout/sessions/${session.id}`,
  "-H",
  `Authorization: Bearer ${apiKey}`,
])
const payment = read.payment as { tx_hash?: string } | null
console.log(`curl → session ${read.status}; payment tx ${payment?.tx_hash ?? "none"}`)
await sql.end()
