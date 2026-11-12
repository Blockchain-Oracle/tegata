/**
 * Proof: referrals end to end on testnet, through the same services the app uses.
 *
 *   tsx src/proofs/referral.ts setup   a second business (its own NEAR account), invited by the first business in
 *                                       the database; checks that self-referral and same-email are refused; prints
 *                                       a pay link for the invited business
 *   tsx src/proofs/referral.ts sweep   runs the worker's sweep once and prints each referral's state
 *
 * Pay the printed link with `pnpm ops pay-link <link> <dollars>`: the operator is a third-party customer there.
 */

import { newProofKey, randomHandle } from "@tegata/core/fixtures"
import { Operator } from "@tegata/core/near"
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
