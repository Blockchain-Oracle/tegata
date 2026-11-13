import { enqueue } from "@tegata/jobs"
import {
  queueDestinationEmails,
  setChainDestinationByOwner,
  setDestinationByOwner,
} from "@tegata/services"
import { z } from "zod"
import { addressLooksRight, PAYER_ROUTES } from "@/lib/routes"
import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

const NEAR_ACCOUNT = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/

const body = z.union([
  z.object({
    accountId: z
      .string()
      .trim()
      .toLowerCase()
      .regex(NEAR_ACCOUNT, "That isn't a NEAR account name"),
  }),
  z.object({ route: z.string().max(40), address: z.string().trim().max(120) }),
])

/**
 * The owner points a person's pay at a NEAR account (Tegata registers it for USDC if needed) or, in Live, an address on
 * another chain. It applies at once.
 */
export const PUT = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const input = body.parse(await request.json())
  let destination: Awaited<ReturnType<typeof setDestinationByOwner>>
  if ("route" in input) {
    const found = PAYER_ROUTES.find((r) => r.id === input.route)
    if (!found) throw badRequest("Pick a coin and chain")
    if (!addressLooksRight(found.chainMark, input.address))
      throw badRequest(`That doesn't look like an address on ${found.chain}`, "address")
    destination = await setChainDestinationByOwner(db(), workspace.id, id, input)
  } else destination = await setDestinationByOwner(db(), workspace.id, id, input.accountId)
  if (!destination.readyAt) {
    await enqueue(
      await boss(),
      "destinationRegister",
      { destinationId: destination.id },
      destination.id,
    )
  }
  await queueDestinationEmails(db(), destination.id)
  return { ready: Boolean(destination.readyAt) }
})
