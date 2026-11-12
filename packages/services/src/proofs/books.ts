/**
 * Proof: Books on testnet (plan S06), through the services the app and worker use.
 *
 *   tsx src/proofs/books.ts <statement.pdf path>
 *
 * A proof business (its own key) makes a pay link; a customer with its own NEAR account (funded by Tegata's operator)
 * pays it $0.20 the way a NEAR wallet does, through the running app (local web + worker). The business refunds $0.05
 * as one gas-free transfer back to that account. Then the month's movements are listed, the CSV and the statement are
 * written, and the account is reconciled against NearBlocks: every transfer on it should be one Tegata recorded.
 */
import { writeFileSync } from "node:fs"

import { NETWORKS } from "@tegata/config"
import { newProofKey, randomHandle } from "@tegata/core/fixtures"
import { fromUnits } from "@tegata/core/money"
import { explorerTx, ftTransfer, Operator, signatureToBase64, usdcBalance } from "@tegata/core/near"
import { createDb, schema } from "@tegata/db"
import { renderStatementPdf } from "@tegata/documents"
import { loadDotEnv, operatorKeys, serverEnv } from "@tegata/env"
import { eq } from "drizzle-orm"

import { draftRefund, monthRange, movements, reconcile, settleRefund, totals } from "../books.ts"
import { createLink } from "../payments.ts"
import { processRelay, submitRelaySignature } from "../relays.ts"
import { onboard, setupAccount } from "../users.ts"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const env = serverEnv()
const { db, sql } = createDb(env.DATABASE_URL)
const operator = new Operator("testnet", operatorKeys("testnet", env))
const usdc = NETWORKS.testnet.usdc
const CENT = 10_000n
const CUSTOMER_GAS_YOCTO = 50_000_000_000_000_000_000_000n
const FOLLOW_TRIES = 40
const FOLLOW_EVERY_MS = 2_000
const out = process.argv[2] ?? "statement.pdf"

// The business, with its own key, as a Privy sign-up would create it.
const handle = randomHandle("books")
const key = newProofKey()
const [user] = await db
  .insert(schema.users)
  .values({ email: `${handle}@proof.tegata.test`, publicKey: key.getPublicKey().toString() })
  .returning()
if (!user) throw new Error("no user")
const opened = await onboard(db, {
  userId: user.id,
  handle,
  businessName: "Proof Books Studio",
  timezone: "UTC",
  networks: ["testnet"],
})
for (const account of opened.accounts) await setupAccount(db, operator, account.id)
const workspace = opened.workspace
if (!workspace) throw new Error("no workspace")
const businessId = `${handle}.${operator.accountId}`
const link = await createLink(db, {
  workspaceId: workspace.id,
  ownerId: user.id,
  network: "testnet",
  title: "Design review",
})
console.log(`Business ${businessId}; link ${env.APP_URL}/pay/${link.token}`)

// A customer with its own NEAR account pays the link from its wallet, through the running app.
const customerKey = newProofKey()
const customerId = `${randomHandle("customer")}.${operator.accountId}`
await operator.createUserAccount(
  customerId,
  customerKey.getPublicKey().toString(),
  CUSTOMER_GAS_YOCTO,
)
await operator.registerOnUsdc(customerId)
await operator.call(usdc, [ftTransfer(customerId, 20n * CENT, "tegata:test-dollars")])
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
  `/api/pay/${link.token}/attempts`,
  { rail: "near_wallet", payer: customerId, amount: "0.20" },
)
const customer = new Operator("testnet", [customerKey.toString()], customerId)
const paid = await customer.call(usdc, [
  ftTransfer(attempt.receiverId, BigInt(attempt.amount), attempt.memo),
])
console.log(`Customer ${customerId} paid 0.20: ${explorerTx("testnet", paid.hash)}`)
await post(`/api/pay/attempts/${attempt.paymentId}/tx`, { txHash: paid.hash, payer: customerId })
for (let i = 0; i < FOLLOW_TRIES; i++) {
  const [p] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, attempt.paymentId))
  if (p?.status === "succeeded") break
  await new Promise((r) => setTimeout(r, FOLLOW_EVERY_MS))
}

// The business refunds 0.05 to the account that paid: one gas-free transfer, signed with its own key.
const draft = await draftRefund(db, {
  workspaceId: workspace.id,
  userId: user.id,
  publicKey: key.getPublicKey().toString(),
  paymentId: attempt.paymentId,
  amount: 5n * CENT,
})
const signature = signatureToBase64(
  key.sign(Uint8Array.from(Buffer.from(draft.draft.hash, "hex"))).signature,
)
await submitRelaySignature(db, { relayId: draft.relayId, userId: user.id, signature })
const refund = await processRelay(db, operator, draft.relayId)
const payment = await settleRefund(db, draft.relayId)
console.log(
  `Refund 0.05 ${refund?.status}: ${refund?.txHash ? explorerTx("testnet", refund.txHash) : ""}; payment refunded ${fromUnits(payment?.refunded ?? 0n, 6)}`,
)
console.log(`Customer now holds ${fromUnits(await usdcBalance("testnet", customerId), 6)} USDC`)

// The month, the CSV row count, the statement and reconciliation.
const month = new Date().toISOString().slice(0, 7)
const { from, to } = monthRange(month, "UTC")
const list = await movements(db, {
  userId: user.id,
  workspaceId: workspace.id,
  network: "testnet",
  from,
  to,
})
for (const m of list)
  console.log(
    `  ${m.direction === "in" ? "+" : "−"}${fromUnits(m.amount, 6)} ${m.kind} · ${m.title} · ${m.status}`,
  )
const t = totals(list)
console.log(
  `Month ${month}: in ${fromUnits(t.moneyIn, 6)}, out ${fromUnits(t.moneyOut, 6)}, net ${fromUnits(t.net, 6)}`,
)
const pdf = await renderStatementPdf({
  business: workspace.name,
  address: null,
  taxId: null,
  logo: null,
  month,
  timezone: "UTC",
  accountId: businessId,
  usdc,
  network: "testnet",
  moneyIn: t.moneyIn.toString(),
  moneyOut: t.moneyOut.toString(),
  net: t.net.toString(),
  balance: (await usdcBalance("testnet", businessId)).toString(),
  madeAt: new Date().toISOString().slice(0, 16).replace("T", " "),
  lines: [...list].reverse().map((m) => ({
    when: m.at.toISOString().slice(0, 16).replace("T", " "),
    title: m.title,
    counterparty: m.counterparty ?? m.counterpartyAccount ?? "",
    amount: (m.direction === "in" ? m.amount : -m.amount).toString(),
    status: m.status,
    counted: m.counted,
    tx: m.txHash,
  })),
})
writeFileSync(out, pdf)
console.log(`Statement: ${out} (${pdf.length} bytes)`)
const books = await reconcile(db, {
  userId: user.id,
  workspaceId: workspace.id,
  network: "testnet",
})
console.log(
  `Reconciled: balance ${fromUnits(books.balance, 6)}, ${books.checked} transfers checked, ${books.outside.length} outside Tegata`,
)
for (const o of books.outside) console.log(`  outside: ${o.delta} ${o.other} ${o.txHash}`)
await sql.end()
