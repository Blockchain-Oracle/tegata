import type { NetworkId } from "@tegata/config"
import { createDb, type Db } from "@tegata/db"
import { liveEnabled, serverEnv } from "@tegata/env"
import { connectBoss, type PgBoss } from "@tegata/jobs"

/** One database pool and one queue client per server process, surviving dev reloads. */
const store = globalThis as unknown as { __tegataDb?: Db; __tegataBoss?: Promise<PgBoss> }

export function db(): Db {
  store.__tegataDb ??= createDb(serverEnv().DATABASE_URL).db
  return store.__tegataDb
}

export function boss(): Promise<PgBoss> {
  store.__tegataBoss ??= connectBoss(serverEnv().DATABASE_URL)
  return store.__tegataBoss
}

/** Networks this deployment can use: Sandbox always, Live when the operator has mainnet keys. */
export function activeNetworks(): NetworkId[] {
  return liveEnabled() ? ["testnet", "mainnet"] : ["testnet"]
}
