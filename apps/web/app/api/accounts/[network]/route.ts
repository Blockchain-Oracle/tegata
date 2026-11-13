import { enqueue } from "@tegata/jobs"
import { openNetworkAccount } from "@tegata/services"
import { z } from "zod"

import { requireUser } from "@/lib/server/auth.ts"
import { activeNetworks, boss, db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

/** Open this business's account on another network (the first time in Live); the worker creates and registers it. */
export const POST = route(async (request, context: { params: Promise<{ network: string }> }) => {
  const user = await requireUser(request)
  const network = z.enum(["testnet", "mainnet"]).parse((await context.params).network)
  if (!activeNetworks().includes(network)) throw badRequest("Live isn't open yet")
  const account = await openNetworkAccount(db(), user.id, network)
  if (!account.readyAt)
    await enqueue(await boss(), "accountSetup", { accountRowId: account.id }, account.id)
  return { account }
})
