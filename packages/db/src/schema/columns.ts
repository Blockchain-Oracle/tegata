import { customType, timestamp, uuid } from "drizzle-orm/pg-core"

/** Wide enough for any token amount in base units. */
const MONEY_PRECISION = 78

/** A random UUID primary key. */
export const id = () => uuid().primaryKey().defaultRandom()

/** Money in base units. Stored as `numeric`, read and written as `bigint`. */
export const money = customType<{ data: bigint; driverData: string }>({
  dataType: () => `numeric(${MONEY_PRECISION}, 0)`,
  toDriver: (value) => value.toString(),
  fromDriver: (value) => BigInt(value),
})

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()
export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
