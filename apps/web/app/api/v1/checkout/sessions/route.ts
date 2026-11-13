import { parseDollars } from "@tegata/core/invoices"
import { serverEnv } from "@tegata/env"
import { createSession, DeveloperError, sessionObject } from "@tegata/services"
import { z } from "zod"

import { requireKey } from "@/lib/server/api-v1.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const body = z.object({
  /** Dollars: "25", "25.50" or 25.5. */
  amount: z.union([z.string(), z.number()]),
  description: z.string().max(80).optional().default(""),
  success_url: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.string().max(500)).optional(),
})

/**
 * Create a checkout session: a one-time request paid on Tegata's pay page. Send `Idempotency-Key` to make retries
 * safe: the same key returns the same session.
 */
export const POST = route(async (request) => {
  const { key, workspace, network } = await requireKey(request)
  const input = body.parse(await request.json())
  const amount = parseDollars(String(input.amount))
  if (amount === null)
    throw new DeveloperError("bad_input", "amount must look like 25 or 25.50 (dollars)")
  const session = await createSession(db(), {
    apiKeyId: key.id,
    workspaceId: workspace.id,
    ownerId: workspace.ownerId,
    network,
    amount,
    description: input.description,
    successUrl: input.success_url ?? null,
    metadata: input.metadata ?? null,
    idempotencyKey: request.headers.get("idempotency-key")?.slice(0, 200) ?? null,
  })
  return Response.json(await sessionObject(db(), session, serverEnv().APP_URL), { status: 201 })
})
