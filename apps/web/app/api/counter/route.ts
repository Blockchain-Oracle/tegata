import { atLocal, localToday, parseDollars } from "@tegata/core/invoices"
import { schema } from "@tegata/db"
import { serverEnv } from "@tegata/env"
import { createSession } from "@tegata/services"
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const SALES_SHOWN = 20

/** Today's counter sales (since midnight in the business's time zone, newest first), each paid one with its receipt. */
export const GET = route(async (request) => {
  const { workspace } = await requireOwner(request)
  const [year, month, day] = localToday(workspace.timezone).split("-").map(Number) as [
    number,
    number,
    number,
  ]
  const from = atLocal({ year, month, day }, 0, workspace.timezone)
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
  // A paid sale opens its receipt and shows how it was paid (plan 6.8 Z).
  const paidIds = rows.filter((r) => r.status === "paid").map((r) => r.id)
  const paid = paidIds.length
    ? await db()
        .select({
          requestId: schema.payments.requestId,
          rail: schema.payments.rail,
          assetIn: schema.payments.assetIn,
          receiptToken: schema.receipts.token,
        })
        .from(schema.payments)
        .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
        .where(
          and(inArray(schema.payments.requestId, paidIds), eq(schema.payments.status, "succeeded")),
        )
    : []
  const paymentOf = new Map(paid.map((p) => [p.requestId, p]))
  return {
    sales: rows.map((r) => {
      const payment = paymentOf.get(r.id)
      return {
        id: r.id,
        token: r.token,
        title: r.title,
        amount: (r.amount ?? 0n).toString(),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        receiptToken: payment?.receiptToken ?? null,
        rail: payment?.rail ?? null,
        assetIn: payment?.assetIn ?? null,
      }
    }),
  }
})

const body = z.object({
  amount: z.string().trim(),
  note: z.string().trim().max(80).optional().default(""),
})

/** A counter sale: a one-time request the customer pays by scanning its QR. */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { user, workspace } = await requireOwner(request)
  const input = body.parse(await request.json())
  const amount = parseDollars(input.amount)
  if (amount === null || amount <= 0n) throw badRequest("Enter an amount like 4.50", "amount")
  const sale = await createSession(db(), {
    apiKeyId: null,
    workspaceId: workspace.id,
    ownerId: user.id,
    network: network,
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
