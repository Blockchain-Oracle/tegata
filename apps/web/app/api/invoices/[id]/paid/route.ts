import { parseDollars } from "@tegata/core/invoices"
import { markPaidByHand } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { badRequest, route } from "@/lib/server/http.ts"

const body = z.object({ amount: z.string(), note: z.string().max(120).nullable().optional() })

/** Record money that arrived outside Tegata (a bank transfer, cash). Its receipt says so. */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { workspace } = await requireOwner(request)
  const input = body.parse(await request.json())
  const amount = parseDollars(input.amount)
  if (amount === null) throw badRequest("Enter an amount like 250 or 250.50", "amount")
  const payment = await markPaidByHand(
    db(),
    workspace.id,
    z.uuid().parse((await context.params).id),
    {
      amount,
      note: input.note ?? null,
    },
  )
  return { payment }
})
