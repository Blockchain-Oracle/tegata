/**
 * Check, against the database only: an approver's invite closes after TREASURY.inviteDays. Its page says so, joining
 * is refused, the owner can invite the same email again, and that sends a fresh link (the old one no longer opens).
 * Run: `pnpm --dir packages/services exec tsx src/proofs/team-invite-expiry.ts`.
 */
import { TREASURY } from "@tegata/config"
import { newProofKey, randomHandle } from "@tegata/core/fixtures"
import { createDb, schema } from "@tegata/db"
import { loadDotEnv, serverEnv } from "@tegata/env"
import { eq } from "drizzle-orm"

import { inviteApprover, joinTeam, teamInvite } from "../team.ts"
import { onboard } from "../users.ts"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const { db, sql } = createDb(serverEnv().DATABASE_URL)

async function user(prefix: string) {
  const handle = randomHandle(prefix)
  const [row] = await db
    .insert(schema.users)
    .values({
      email: `${handle}@proof.tegata.test`,
      publicKey: newProofKey().getPublicKey().toString(),
    })
    .returning()
  if (!row) throw new Error("Could not create the user")
  return { row, handle }
}

const owner = await user("exp")
const opened = await onboard(db, {
  userId: owner.row.id,
  handle: owner.handle,
  businessName: "Expiry Studio",
  timezone: "UTC",
  networks: ["testnet"],
})
const workspaceId = opened.workspace?.id ?? ""
const mia = await user("mia")
const invite = { workspaceId, ownerId: owner.row.id, network: "testnet" as const }

const first = await inviteApprover(db, { ...invite, name: "Mia", email: mia.row.email ?? "" })
const old = first?.token ?? ""
console.log(`Invited: link ${old}, expired=${(await teamInvite(db, old))?.expired}`)

try {
  await inviteApprover(db, { ...invite, name: "Mia", email: mia.row.email ?? "" })
  console.log("Second invite while open: allowed (UNEXPECTED)")
} catch (error) {
  console.log(`Second invite while open: refused (${(error as Error).message})`)
}

const back = new Date(Date.now() - (TREASURY.inviteDays + 1) * 86_400_000)
await db
  .update(schema.teamMembers)
  .set({ invitedAt: back })
  .where(eq(schema.teamMembers.id, first?.id ?? ""))
console.log(
  `${TREASURY.inviteDays + 1} days later: expired=${(await teamInvite(db, old))?.expired}`,
)
try {
  await joinTeam(db, old, { id: mia.row.id, email: mia.row.email })
  console.log("Join on the expired link: allowed (UNEXPECTED)")
} catch (error) {
  console.log(`Join on the expired link: refused (${(error as Error).message})`)
}

const again = await inviteApprover(db, { ...invite, name: "Mia", email: mia.row.email ?? "" })
const fresh = again?.token ?? ""
console.log(
  `Sent again: new link ${fresh} (${fresh !== old ? "different" : "SAME"}), expired=${(await teamInvite(db, fresh))?.expired}, old link opens=${(await teamInvite(db, old)) !== null}`,
)
await sql.end()
