import { NETWORKS } from "@tegata/config"
import { publicRequest } from "@tegata/services"

import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"

/** What a payer sees: who is asking, for what, how much, and where it lands. Nothing private. */
export const GET = route(async (_request, context: { params: Promise<{ token: string }> }) => {
  const { token } = await context.params
  const found = await publicRequest(db(), token)
  if (!found) throw notFound("This pay link doesn't exist")
  const { request, business } = found
  return {
    token: request.token,
    business,
    title: request.title,
    note: request.note,
    amount: request.amount,
    status: request.status,
    network: request.network,
    receiverId: request.receiverId,
    usdc: NETWORKS[request.network].usdc,
  }
})
