import { autopilotPreview } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const CHOICES = new Set([3, 6, 12])

/** What turning autopilot on would pay: the ready rows, who's left out and why, and the next paydays at 09:00. */
export const GET = route(async (request) => {
  const network = requestNetwork(request)
  const { workspace } = await requireOwner(request)
  const asked = Number(new URL(request.url).searchParams.get("count") ?? "3")
  const preview = await autopilotPreview(db(), {
    workspaceId: workspace.id,
    network: network,
    timezone: workspace.timezone,
    count: CHOICES.has(asked) ? asked : 3,
  })
  return { ...preview, total: preview.total.toString(), timezone: workspace.timezone }
})
