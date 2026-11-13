import { requireOwner } from "@/lib/server/auth.ts"
import { developersView } from "@/lib/server/developers.ts"
import { route } from "@/lib/server/http.ts"

/** Keys, endpoints, deliveries and the test inbox. */
export const GET = route(async (request) => {
  const { workspace } = await requireOwner(request)
  return developersView(workspace.id)
})
