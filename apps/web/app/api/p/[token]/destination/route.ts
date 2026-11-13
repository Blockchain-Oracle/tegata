import { enqueue } from "@tegata/jobs"
import { chooseDestination, queueDestinationEmails } from "@tegata/services"
import { z } from "zod"
import { addressLooksRight, PAYER_ROUTES } from "@/lib/routes"
import { requireUser } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"
import { personPageView } from "@/lib/server/payroll.ts"

const NEAR_ACCOUNT = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/

const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tegata") }),
  z.object({
    kind: z.literal("chain"),
    route: z.string().max(40),
    address: z.string().trim().max(120),
  }),
  z.object({
    kind: z.literal("near"),
    accountId: z
      .string()
      .trim()
      .toLowerCase()
      .regex(NEAR_ACCOUNT, "That isn't a NEAR account name"),
  }),
])

/** The person, signed in with the invited email, chooses where their pay lands. */
export const POST = route(async (request, context: { params: Promise<{ token: string }> }) => {
  const user = await requireUser(request)
  const { token } = await context.params
  const choice = body.parse(await request.json())
  if (choice.kind === "chain") {
    const found = PAYER_ROUTES.find((r) => r.id === choice.route)
    if (!found) throw badRequest("Pick a coin and chain")
    if (!addressLooksRight(found.chainMark, choice.address))
      throw badRequest(`That doesn't look like an address on ${found.chain}`, "address")
  }
  const destination = await chooseDestination(db(), token, user, choice)
  if (destination.kind === "near" && !destination.readyAt) {
    await enqueue(
      await boss(),
      "destinationRegister",
      { destinationId: destination.id },
      destination.id,
    )
  }
  // A change that waits 24 hours is told to the person and the business, so nobody moves pay unseen.
  await queueDestinationEmails(db(), destination.id)
  return { page: await personPageView(token) }
})
