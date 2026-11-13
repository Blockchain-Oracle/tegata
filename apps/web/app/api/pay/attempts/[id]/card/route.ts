import { enqueue } from "@tegata/jobs"
import { setCardOrder } from "@tegata/services"
import { z } from "zod"

import { boss, db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"

/**
 * The checkout told the page its Transak order id: keep it, and follow the order now. The id alone proves nothing:
 * the worker reads the order from Transak and checks it names this payment.
 */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const id = z.uuid().parse((await context.params).id)
  const { orderId } = z.object({ orderId: z.string().min(4).max(80) }).parse(await request.json())
  const row = await setCardOrder(db(), id, orderId)
  if (!row) throw notFound("No open card payment")
  await enqueue(await boss(), "cardPayPoll", { paymentId: id }, `card-pay:${id}`)
  return { ok: true }
})
