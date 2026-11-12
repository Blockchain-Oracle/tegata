/**
 * Proof: referrals end to end on testnet, through the same services the app uses.
 *
 *   tsx src/proofs/referral.ts setup   a second business (its own NEAR account), invited by the first business in
 *                                       the database; checks that self-referral and same-email are refused; prints
 *                                       a pay link for the invited business
 *   tsx src/proofs/referral.ts pay <link> <dollars>
 *                                       a fresh customer (its own NEAR account, funded by the operator, never by
 *                                       either business) pays the link the way a NEAR wallet does
 *   tsx src/proofs/referral.ts sweep   runs the worker's sweep once and prints each referral's state
 *
 * Pay the printed link with `pnpm ops pay-link <link> <dollars>`: the operator is a third-party customer there.
 */

import { NETWORKS } from "@tegata/config"
import { newProofKey, randomHandle } from "@tegata/core/fixtures"
import { fromUnits } from "@tegata/core/money"
import { explorerTx, ftTransfer, Operator } from "@tegata/core/near"
import { createDb, schema } from "@tegata/db"
import { loadDotEnv, operatorKeys, serverEnv } from "@tegata/env"
import { asc, eq } from "drizzle-orm"

import { createLink } from "../payments.ts"
import { attachReferral, ReferralError, sweepReferrals } from "../referrals.ts"
import { onboard, setupAccount } from "../users.ts"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const env = serverEnv()
const { db, sql } = createDb(env.DATABASE_URL)
const operator = new Operator("testnet", operatorKeys("testnet", env))
const [command] = process.argv.slice(2)
/** Gas money for the proof customer's own transaction (0.05 NEAR). */
const CUSTOMER_GAS_YOCTO = 50_000_000_000_000_000_000_000n
/** A cent over, so the customer never runs short. */
const CUSTOMER_SPARE = 10_000n
const FOLLOW_TRIES = 30
const FOLLOW_EVERY_MS = 2_000

async function refused(label: string, attempt: () => Promise<unknown>) {
  try {
    await attempt()
    console.log(`✗ ${label}: was NOT refused`)
    process.exitCode = 1
  } catch (error) {
    if (!(error instanceof ReferralError)) throw error
    console.log(`✓ ${label}: refused ("${error.message}")`)
  }
}

if (command === "setup") {
  const [first] = await db.select().from(schema.users).orderBy(asc(schema.users.createdAt)).limit(1)
  if (!first?.handle) throw new Error("No business in this database yet")
  const handle = randomHandle("ref")
  const key = newProofKey()
  const [user] = await db
    .insert(schema.users)
    .values({ email: `${handle}@proof.tegata.test`, publicKey: key.getPublicKey().toString() })
    .returning()
  if (!user) throw new Error("Could not create the proof user")
  const opened = await onboard(db, {
    userId: user.id,
    handle,
    businessName: `Proof ${handle}`,
    timezone: "UTC",
    networks: ["testnet"],
  })
  for (const account of opened.accounts) await setupAccount(db, operator, account.id)
  console.log(`Invited business: ${handle}.tegata.testnet (created on NEAR, registered on USDC)`)

  await refused("Referring yourself", () =>
    attachReferral(db, { refereeId: first.id, handle: first.handle ?? "", network: "testnet" }),
  )
  const [twin] = await db
    .insert(schema.users)
    .values({
      email: first.email?.replace("@", "+twin@") ?? "twin@proof.tegata.test",
      publicKey: null,
    })
    .returning()
  if (twin) {
    await refused("The same inbox under a +tag", () =>
      attachReferral(db, { refereeId: twin.id, handle: first.handle ?? "", network: "testnet" }),
    )
    await db.delete(schema.users).where(eq(schema.users.id, twin.id))
  }

  const referral = await attachReferral(db, {
    refereeId: user.id,
    handle: first.handle,
    network: "testnet",
  })
  console.log(`Referral ${referral?.id}: ${handle} invited by ${first.handle}`)
  const link = await createLink(db, {
    workspaceId: opened.workspace?.id ?? "",
    ownerId: user.id,
    network: "testnet",
    title: "Proof customer payment",
  })
  console.log(`Pay link of the invited business: ${env.APP_URL}/pay/${link.token}`)
} else if (command === "pay") {
  const [, target, dollars] = process.argv.slice(2)
  const url = new URL(target ?? "")
  const token = url.pathname.split("/pay/")[1]
  const amount = BigInt(Math.round(Number(dollars) * 100)) * 10_000n
  if (!token || amount <= 0n) throw new Error("Use: pay <pay link URL> <dollars>")
  const usdc = NETWORKS.testnet.usdc
  // A customer neither business ever sent money to: its own key, gas from the operator, dollars from the stash.
  const key = newProofKey()
  const customerId = `${randomHandle("customer")}.${operator.accountId}`
  const created = await operator.createUserAccount(
    customerId,
    key.getPublicKey().toString(),
    CUSTOMER_GAS_YOCTO,
  )
  if (created.status !== "success")
    throw new Error(`Creating the customer failed: ${created.error}`)
  await operator.registerOnUsdc(customerId)
  const funded = await operator.call(usdc, [ftTransfer(customerId, amount + CUSTOMER_SPARE)])
  if (funded.status !== "success") throw new Error(`Funding the customer failed: ${funded.error}`)
  console.log(`Customer ${customerId} holds ${fromUnits(amount + CUSTOMER_SPARE, 6)} USDC`)

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
  }>(`/api/pay/${token}/attempts`, { rail: "near_wallet", payer: customerId, amount: dollars })
  const customer = new Operator("testnet", [key.toString()], customerId)
  const sent = await customer.call(usdc, [
    ftTransfer(attempt.receiverId, BigInt(attempt.amount), attempt.memo),
  ])
  console.log(
    `Customer paid ${fromUnits(BigInt(attempt.amount), 6)} USDC: ${explorerTx("testnet", sent.hash)}`,
  )
  await post(`/api/pay/attempts/${attempt.paymentId}/tx`, { txHash: sent.hash, payer: customerId })
  for (let i = 0; i < FOLLOW_TRIES; i++) {
    const view = (await (
      await fetch(`${url.origin}/api/pay/attempts/${attempt.paymentId}`)
    ).json()) as {
      status: string
    }
    if (view.status !== "awaiting" && view.status !== "detected") {
      console.log(`Payment ${view.status}`)
      break
    }
    await new Promise((resolve) => setTimeout(resolve, FOLLOW_EVERY_MS))
  }
} else if (command === "sweep") {
  const result = await sweepReferrals(db, operator)
  console.log(`Sweep: ${result.checked} open checked, ${result.paid.length} paid`)
  const rows = await db.select().from(schema.referrals).orderBy(asc(schema.referrals.createdAt))
  for (const r of rows) {
    console.log(
      `${r.id.slice(0, 8)} ${r.refereeAccount} → ${r.status}; received ${Number(r.received) / 1e6} USDC; locked ${r.lockedAt ? "yes" : "no"}${r.voidReason ? `; ${r.voidReason}` : ""}`,
    )
  }
} else {
  console.error("Use: setup | sweep")
  process.exitCode = 2
}
await sql.end()
