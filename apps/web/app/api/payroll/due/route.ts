import { payrollDue } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { PAYROLL_NETWORK } from "@/lib/server/payroll.ts"

/** Home's "Payroll due": the payday has come and no run has paid it. Null otherwise. */
export const GET = route(async (request) => {
  const { workspace } = await requireOwner(request)
  return { due: await payrollDue(db(), workspace.id, PAYROLL_NETWORK, workspace.timezone) }
})
