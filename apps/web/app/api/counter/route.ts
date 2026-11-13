import { parseDollars } from "@tegata/core/invoices"
import { schema } from "@tegata/db"
import { serverEnv } from "@tegata/env"
import { createSession, monthRange } from "@tegata/services"
import { and, desc, eq, gte, sql } from "drizzle-orm"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { PAYROLL_NETWORK } from "@/lib/server/payroll.ts"

const SALES_SHOWN = 20

/** Today's counter sales (since the start of the month, in the business's time zone, newest first). */
export const GET = route(async (request) => {
  const { workspace } = await requireOwner(request)
  const { from } = monthRange(new Date().toISOString().slice(0, 7), workspace.timezone)
  const rows = await db()
    .select()
    .from(schema.requests)
    .where(
      and(
        eq(schema.requests.workspaceId, workspace.id),
        eq(schema.requests.kind, "session"),
        sql`${schema.requests.metadata}->>'source' = 'counter'`,
        gte(schema.requests.createdAt, from),
      ),
    )
    .orderBy(desc(schema.requests.createdAt))
    .limit(SALES_SHOWN)
  return {
    sales: rows.map((r) => ({
      id: r.id,
      token: r.token,
      title: r.title,
      amount: (r.amount ?? 0n).toString(),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  }
})

const body = z.object({
  amount: z.string().trim(),
  note: z.string().trim().max(80).optional().default(""),
})

/** A counter sale: a one-time request the customer pays by scanning its QR. */
export const POST = route(async (request) => {
  const { user, workspace } = await requireOwner(request)
  const input = body.parse(await request.json())
  const amount = parseDollars(input.amount)
  if (amount === null || amount <= 0n) throw badRequest("Enter an amount like 4.50", "amount")
  const sale = await createSession(db(), {
    apiKeyId: null,
    workspaceId: workspace.id,
    ownerId: user.id,
    network: PAYROLL_NETWORK,
    amount,
    description: input.note || "Counter sale",
    successUrl: null,
    metadata: null,
    idempotencyKey: null,
    source: "counter",
  })
  return {
    id: sale.id,
    token: sale.token,
    url: `${serverEnv().APP_URL}/pay/${sale.token}`,
    amount: amount.toString(),
  }
})
