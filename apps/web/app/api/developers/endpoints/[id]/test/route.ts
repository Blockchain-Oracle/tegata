import { emitEvent, ownEndpoint } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { sendNow } from "@/lib/server/developers.ts"
import { route } from "@/lib/server/http.ts"

/** Send a `ping` event to this endpoint only, now. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const endpoint = await ownEndpoint(db(), workspace.id, z.uuid().parse((await context.params).id))
  const deliveries = await emitEvent(db(), {
    workspaceId: workspace.id,
    network: endpoint.network,
    type: "ping",
    data: { object: "ping", message: "Hello from Tegata", endpoint_id: endpoint.id },
    dedupe: `ping:${endpoint.id}:${crypto.randomUUID()}`,
    endpointId: endpoint.id,
  })
  await sendNow(deliveries)
  return { queued: deliveries.length }
})
