import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { route } from "@/lib/server/http.ts"
import { runView } from "@/lib/server/payroll.ts"

/** A run with its rows and each batch's state (the run page polls this until it is final). */
export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  return { run: await runView(workspace.id, z.uuid().parse((await context.params).id)) }
})
