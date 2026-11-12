/**
 * Proof: an invoice issued and sent through the same services the app uses, for the first business in the local
 * database. Prints its pay link; pay it with `pnpm ops pay-link <link> <dollars>` (part-payments are allowed).
 */

import { addDays, localToday } from "@tegata/core/invoices"
import { createDb, schema } from "@tegata/db"
import { loadDotEnv, serverEnv } from "@tegata/env"

import { createCustomer, createDraft, sendInvoice } from "../invoices.ts"

loadDotEnv(new URL("../../../../.env", import.meta.url).pathname)
const { db, sql } = createDb(serverEnv().DATABASE_URL)
const [workspace] = await db.select().from(schema.workspaces).limit(1)
if (!workspace) throw new Error("No business in this database")
const customer = await createCustomer(db, workspace.id, { name: "Proof Customer", email: null })
const today = localToday(workspace.timezone)
const draft = await createDraft(
  db,
  { workspaceId: workspace.id, network: "testnet" },
  {
    customerId: customer.id,
    issueDate: today,
    dueDate: addDays(today, 7),
    notes: "Proof of a part-paid invoice",
    discount: null,
    taxBp: 0,
    allowPartial: true,
    reminders: false,
    repeat: null,
    lines: [{ description: "Proof item", quantityMilli: 1_000n, unitPrice: 500_000n }],
  },
)
const sent = await sendInvoice(
  db,
  { workspaceId: workspace.id, ownerId: workspace.ownerId },
  draft.id,
)
console.log(
  `INV-${String(sent.invoice.number).padStart(4, "0")} for ${workspace.name}: $0.50, part-payments on`,
)
console.log(`${serverEnv().APP_URL}/pay/${sent.token}`)
console.log(`invoice id ${sent.invoice.id}`)
await sql.end()
