import { receiveAtInbox } from "@tegata/services"

import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const MAX_BODY = 20_000

/** Tegata's test inbox: records the webhook and whether its Standard Webhooks signature is valid. */
export const POST = route(async (request, context: { params: Promise<{ token: string }> }) => {
  const body = (await request.text()).slice(0, MAX_BODY)
  const headers = Object.fromEntries(request.headers.entries())
  const verified = await receiveAtInbox(db(), (await context.params).token, body, headers)
  return Response.json({ received: true, verified })
})
