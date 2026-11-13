import { searchWorkspace } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const MAX_QUERY = 80

/** ⌘K: this business's invoices, customers, people and pay links matching `?q=`. */
export const GET = route(async (request) => {
  const { workspace } = await requireOwner(request)
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, MAX_QUERY)
  return searchWorkspace(db(), workspace.id, q)
})
