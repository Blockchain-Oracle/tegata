import { suggestHandle } from "@tegata/core/near"
import { handleUnavailable } from "@tegata/services"

import { requireUser } from "@/lib/server/auth.ts"
import { activeNetworks, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** Is `?name=` free as `name.tegata.near`? Also turns a business name into a suggestion. */
export const GET = route(async (request) => {
  await requireUser(request)
  const params = new URL(request.url).searchParams
  const handle = params.get("name") ?? suggestHandle(params.get("from") ?? "")
  const problem = await handleUnavailable(db(), handle, activeNetworks())
  return { handle, available: problem === null, problem }
})
