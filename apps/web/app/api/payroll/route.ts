import { emailConfigured } from "@tegata/env"
import { setSchedule } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { PAYROLL_NETWORK, runsView, scheduleView } from "@/lib/server/payroll.ts"

/** The schedule, the next payday and the runs so far. */
export const GET = route(async (request) => {
  const { workspace } = await requireOwner(request)
  return {
    timezone: workspace.timezone,
    schedule: await scheduleView(workspace.id),
    runs: await runsView(workspace.id),
    emailEnabled: emailConfigured(),
  }
})

const body = z.object({
  cadence: z.enum(["weekly", "fortnightly", "monthly"]),
  nextPayday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a payday"),
})

/** Set how often the team is paid and the next payday, in the business's time zone. */
export const PUT = route(async (request) => {
  const { workspace } = await requireOwner(request)
  const input = body.parse(await request.json())
  await setSchedule(db(), {
    workspaceId: workspace.id,
    network: PAYROLL_NETWORK,
    timezone: workspace.timezone,
    ...input,
  })
  return { schedule: await scheduleView(workspace.id) }
})
