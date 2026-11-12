import { index, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import { createdAt, id, money, updatedAt } from "./columns.ts"
import { users } from "./identity.ts"

export const testDollarStatus = pgEnum("test_dollar_status", ["queued", "sent", "failed"])

/**
 * Sandbox test dollars: Circle testnet USDC the operator sends a person so they can try paying without a wallet.
 * One grant per person per UTC day; the unique index makes a double click a no-op rather than a double send.
 */
export const testDollars = pgTable(
  "test_dollars",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text().notNull(),
    amount: money().notNull(),
    /** The UTC day, `YYYY-MM-DD`. */
    day: text().notNull(),
    status: testDollarStatus().notNull().default("queued"),
    /** Saved before the transfer is broadcast, so a restart checks NEAR instead of sending again. */
    txHash: text(),
    error: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("test_dollars_day_idx").on(table.userId, table.day),
    index("test_dollars_status_idx").on(table.status),
  ],
)
