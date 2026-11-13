import { enqueue } from "@tegata/jobs"
import { queueDestinationEmails, setDestinationByOwner } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const NEAR_ACCOUNT = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/

const body = z.object({
  accountId: z.string().trim().toLowerCase().regex(NEAR_ACCOUNT, "That isn't a NEAR account name"),
})

/** The owner points a person's pay at a NEAR account. It applies at once; Tegata registers it for USDC if needed. */
export const PUT = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const { accountId } = body.parse(await request.json())
  const destination = await setDestinationByOwner(db(), workspace.id, id, accountId)
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
