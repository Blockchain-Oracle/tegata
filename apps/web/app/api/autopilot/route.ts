import { parseDollars } from "@tegata/core/invoices"
import { enqueue } from "@tegata/jobs"
import { prepareAutopilot } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { autopilotView } from "@/lib/server/autopilot.ts"
import { boss, db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** The autopilot: our record and the contract's numbers (set aside, the plan's next payday). */
export const GET = route(async (request) => {
  const network = requestNetwork(request)
  const { workspace } = await requireOwner(request)
  return { autopilot: await autopilotView(workspace.id, workspace.timezone, network) }
})

const body = z.object({ count: z.number().int(), setAside: z.string().trim() })

/** Start turning it on: snapshot the team and paydays; the worker registers the business (Tegata pays). */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { user, workspace } = await requireOwner(request)
  // The autopilot contract runs on testnet; `pay.tegata.near` isn't deployed on mainnet yet.
  if (network === "mainnet")
    throw badRequest(
      "Autopilot in Live opens when its contract is on NEAR mainnet. It runs in the Sandbox now.",
    )
  const input = body.parse(await request.json())
  const setAside = parseDollars(input.setAside)
  if (setAside === null) throw badRequest("Enter an amount like 2400 or 2,400.50", "amount")
  const row = await prepareAutopilot(db(), {
    workspaceId: workspace.id,
    ownerId: user.id,
    network: network,
    timezone: workspace.timezone,
    count: input.count,
    setAside,
  })
  if (row.status === "preparing") {
    await enqueue(await boss(), "autopilotRegister", { autopilotId: row.id }, row.id)
  }
  return { id: row.id, status: row.status }
})
