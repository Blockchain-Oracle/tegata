import { enqueue } from "@tegata/jobs"
import { requestTestDollars } from "@tegata/services"

import { requireUser } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** Sandbox: ask for today's test dollars; the worker sends them from the operator's stash. */
export const POST = route(async (request) => {
  const user = await requireUser(request)
  const grant = await requestTestDollars(db(), user.id)
  await enqueue(await boss(), "testDollars", { grantId: grant.id }, grant.id)
  return { id: grant.id, status: grant.status, amount: grant.amount }
})
