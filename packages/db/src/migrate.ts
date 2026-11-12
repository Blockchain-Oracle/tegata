// Worker-only: applies the SQL migrations shipped with this package. Kept out of the main entry so the web bundle
// never tries to bundle the migrations folder.
import { fileURLToPath } from "node:url"

import { migrate } from "drizzle-orm/postgres-js/migrator"

import type { Db } from "./index.ts"

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url))

/** Apply any migrations not yet applied. The worker runs this once at start; it is the single writer of schema. */
export async function migrateDb(db: Db) {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}
