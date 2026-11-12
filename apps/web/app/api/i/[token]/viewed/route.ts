import { markViewed } from "@tegata/services"

import { requireUser } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** The public invoice page calls this once on load: the first open by anyone but the owner records Viewed. */
export const POST = route(async (request, context: { params: Promise<{ token: string }> }) => {
  const { token } = await context.params
  const viewer = await requireUser(request).catch(() => null)
  return { viewed: await markViewed(db(), token, viewer?.id ?? null) }
})
