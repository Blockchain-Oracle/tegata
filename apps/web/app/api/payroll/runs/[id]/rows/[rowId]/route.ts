import { parseDollars } from "@tegata/core/invoices"
import { PayrollError, setRowIncluded, setRowPay } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

const body = z.object({ included: z.boolean() })

/** Dollars as typed ("250", "1,200.50") to base units, or a clear refusal. */
const dollars = (text: string) => {
  const units = parseDollars(text)
  if (units === null) throw new PayrollError("bad_input", `"${text}" isn't an amount in dollars`)
  return units
}
const payBody = z.object({
  /** This run's pay in dollars; null keeps their usual pay. */
  pay: z.string().trim().max(20).nullable(),
  lines: z
    .array(
      z.object({
        kind: z.enum(["bonus", "reimbursement", "deduction"]),
        label: z.string().max(200).default(""),
        amount: z.string().trim().max(20),
      }),
    )
    .max(20),
})

/** Leave someone out of this run, or put them back, while it is being reviewed. */
export const PATCH = route(
  async (request, context: { params: Promise<{ id: string; rowId: string }> }) => {
    const { workspace } = await requireOwner(request)
    const { id, rowId } = await context.params
    await setRowIncluded(db(), {
      workspaceId: workspace.id,
      runId: z.uuid().parse(id),
      rowId: z.uuid().parse(rowId),
      included: body.parse(await request.json()).included,
    })
    return { ok: true }
  },
)

/** This run's pay for one person and its one-off lines, while the run is a draft. Their usual pay is unchanged. */
export const PUT = route(
  async (request, context: { params: Promise<{ id: string; rowId: string }> }) => {
    const { workspace } = await requireOwner(request)
    const { id, rowId } = await context.params
    const input = payBody.parse(await request.json())
    await setRowPay(db(), {
      workspaceId: workspace.id,
      runId: z.uuid().parse(id),
      rowId: z.uuid().parse(rowId),
      pay: input.pay === null || input.pay === "" ? null : dollars(input.pay),
      lines: input.lines.map((line) => ({ ...line, amount: dollars(line.amount) })),
    })
    return { ok: true }
  },
)
