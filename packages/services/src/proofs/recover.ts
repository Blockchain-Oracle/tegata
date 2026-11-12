/**
 * Proof: a relay that is interrupted mid-send lands exactly once.
 *
 *   pnpm --filter @tegata/services exec tsx src/proofs/recover.ts
 *
 * Case A: the worker dies after signing the operator's transaction but before broadcasting.
 * Case B: the worker dies after broadcasting but before recording the result.
 * In both, running the relay again must finish it without a second transfer.
 */
import { NETWORKS, type NetworkId, ONE_YOCTO, TGAS } from "@tegata/config"
import { fundedUser } from "@tegata/core/fixtures"
import { call, Operator, signatureToBase64, tokenBalance } from "@tegata/core/near"
import { createDb, schema } from "@tegata/db"
import { loadDotEnv, operatorKeys, serverEnv } from "@tegata/env"
import { eq } from "drizzle-orm"

import { createRelayDraft, processRelay, submitRelaySignature } from "../relays.ts"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const env = serverEnv()
const network: NetworkId = "testnet"
const token = NETWORKS[network].wnear
const FUNDING = 10n ** 22n

const { db, sql } = createDb(env.DATABASE_URL)
const operator = new Operator(network, operatorKeys("testnet", env))

const funded = await fundedUser(operator, token, FUNDING, 0n)
const publicKey = funded.pair.getPublicKey().toString()
const [user] = await db
  .insert(schema.users)
  .values({ handle: funded.accountId.split(".")[0] ?? null, publicKey })
  .returning()
if (!user) throw new Error("Could not create the user row")

async function approvedRelay(purpose: string) {
  const { relayId, draft } = await createRelayDraft(db, {
    userId: user?.id ?? "",
    network,
    purpose,
    senderId: funded.accountId,
    receiverId: token,
    publicKey,
    calls: [
      call("ft_transfer", { receiver_id: operator.accountId, amount: "1" }, 10n * TGAS, ONE_YOCTO),
    ],
  })
  const { signature } = funded.pair.sign(Uint8Array.from(Buffer.from(draft.hash, "hex")))
  await submitRelaySignature(db, {
    relayId,
    userId: user?.id ?? "",
    signature: signatureToBase64(signature),
  })
  return relayId
}

const before = await tokenBalance(network, token, operator.accountId)

// Case A: crash between "signed and saved" and "broadcast".
const crashing = new Operator(network, operatorKeys("testnet", env))
crashing.broadcast = () => Promise.reject(new Error("simulated crash before broadcast"))
const relayA = await approvedRelay(`proof:recover:a:${funded.accountId}`)
await processRelay(db, crashing, relayA).catch(() => undefined)
const [midA] = await db.select().from(schema.relays).where(eq(schema.relays.id, relayA))
console.log(`A after crash: status=${midA?.status} hash saved=${Boolean(midA?.txHash)}`)
const doneA = await processRelay(db, operator, relayA)
console.log(`A after restart: status=${doneA?.status}`)

// Case B: fully sent, then the result is lost and the relay is processed again.
const relayB = await approvedRelay(`proof:recover:b:${funded.accountId}`)
const firstB = await processRelay(db, operator, relayB)
await db.update(schema.relays).set({ status: "sent" }).where(eq(schema.relays.id, relayB))
const secondB = await processRelay(db, operator, relayB)
console.log(
  `B first run: ${firstB?.status}, second run: ${secondB?.status}, same hash: ${firstB?.txHash === secondB?.txHash}`,
)

const received = (await tokenBalance(network, token, operator.accountId)) - before
console.log(`Operator received ${received} units (expected 2: one per relay, never more)`)

await db.delete(schema.users).where(eq(schema.users.id, user.id))
await sql.end()
const EXPECTED = 2n
if (received !== EXPECTED || doneA?.status !== "success" || secondB?.status !== "success") {
  process.exitCode = 1
}
