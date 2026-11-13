import { listEvents } from "@tegata/services"

import { requireKey } from "@/lib/server/api-v1.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** The latest events, newest first (the same bodies webhooks carry). `?limit=` up to 100. */
export const GET = route(async (request) => {
  const { workspace, network } = await requireKey(request)
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "20")
  const rows = await listEvents(db(), workspace.id, network, Number.isFinite(limit) ? limit : 20)
  return {
    data: rows.map((e) => ({
      id: e.id,
      type: e.type,
      created_at: e.createdAt.toISOString(),
      data: e.data,
    })),
  }
})
