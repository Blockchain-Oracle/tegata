import { verifyBitnobWebhook } from "@tegata/core/bitnob"
import { serverEnv } from "@tegata/env"
import { applyCardWebhook } from "@tegata/services"

import { bitnob } from "@/lib/server/bitnob.ts"
import { db } from "@/lib/server/context.ts"

/**
 * Bitnob's card webhooks (purchases, a card made): the signature is checked on the raw body before anything is read,
 * each event is stored once, and the card is brought up to date.
 */
export async function POST(request: Request) {
  const secret = serverEnv().BITNOB_WEBHOOK_SECRET
  const raw = await request.text()
  if (!secret || !verifyBitnobWebhook(raw, request.headers.get("x-bitnob-signature"), secret))
    return Response.json({ error: "bad signature" }, { status: 401 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return Response.json({ error: "not json" }, { status: 400 })
  }
  const applied = await applyCardWebhook(db(), bitnob(), body).catch(() => null)
  return Response.json({ ok: true, applied: Boolean(applied) })
}
