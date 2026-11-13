import { checkBankHolder } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { noah } from "@/lib/server/bank.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const body = z.object({
  country: z.string().length(2),
  form: z.record(z.string(), z.unknown()),
})

/** Noah's beneficiary check: who holds this bank account, before anything is committed (null where banks don't say). */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { user } = await requireOwner(request)
  const input = body.parse(await request.json())
  return {
    holder: await checkBankHolder(db(), noah(), {
      userId: user.id,
      network,
      country: input.country,
      form: input.form,
    }),
  }
})
