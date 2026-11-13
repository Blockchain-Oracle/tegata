import { allowLocalWebhooks, serverEnv } from "@tegata/env"
import { createEndpoint } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const body = z.union([
  z.object({ url: z.string().trim().min(1).max(500) }),
  z.object({ inbox: z.literal(true) }),
])

/** Add a webhook endpoint (an https URL), or Tegata's own test inbox. Its secret is returned once. */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { workspace } = await requireOwner(request)
  const input = body.parse(await request.json())
  const endpoint = await createEndpoint(db(), {
    workspaceId: workspace.id,
    network: network,
    url: "url" in input ? input.url : undefined,
    inbox: "inbox" in input,
    appUrl: serverEnv().APP_URL,
    allowLocal: allowLocalWebhooks(),
  })
  return { id: endpoint.id, url: endpoint.url, secret: endpoint.secret }
})
