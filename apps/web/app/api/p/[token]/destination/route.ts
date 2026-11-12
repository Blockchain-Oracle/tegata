import { enqueue } from "@tegata/jobs"
import { chooseDestination } from "@tegata/services"
import { z } from "zod"

import { requireUser } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { personPageView } from "@/lib/server/payroll.ts"

const NEAR_ACCOUNT = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/

const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tegata") }),
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
  const destination = await chooseDestination(db(), token, user, body.parse(await request.json()))
  if (destination.kind === "near" && !destination.readyAt) {
    await enqueue(
      await boss(),
      "destinationRegister",
      { destinationId: destination.id },
      destination.id,
    )
  }
  return { page: await personPageView(token) }
})
