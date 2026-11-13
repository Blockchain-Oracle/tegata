import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema/index.ts"

/** Connection pool size per process (web, worker). */
const POOL_MAX = 10

export function createDb(url: string) {
  const sql = postgres(url, {
    max: POOL_MAX,
    onnotice: (notice) => {
      if (notice.severity !== "NOTICE") console.warn("[db]", notice.message)
    },
  })
  return { db: drizzle(sql, { schema, casing: "snake_case" }), sql }
}

export type Db = ReturnType<typeof createDb>["db"]
export type { StoredPayLine } from "./schema/payroll.ts"
export { schema }
