// Cards a business has linked (plan 6.8 AD): a Gnosis Pay card account on the Gnosis chain, topped up from NEAR
// through NEAR Intents. Balances are read live from the chain, never stored.
import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { createdAt, id } from "./columns.ts"
import { network, workspaces } from "./identity.ts"

export const cards = pgTable(
  "cards",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    network: network().notNull(),
    provider: text().notNull().default("gnosis_pay"),
    /** The card account (a Safe on Gnosis), lower-cased. */
    account: text().notNull(),
    label: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("cards_account_idx").on(table.workspaceId, table.network, table.account),
    index("cards_workspace_idx").on(table.workspaceId, table.network),
  ],
)
