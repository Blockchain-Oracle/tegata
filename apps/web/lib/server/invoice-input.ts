import { type Discount, parseDollars, parsePercent, parseQuantity } from "@tegata/core/invoices"
import type { DraftInput } from "@tegata/services"
import { z } from "zod"

import { HttpError } from "./http.ts"

const BAD_REQUEST = 400

/** What the builder sends: amounts and quantities exactly as typed, so the server does all the maths. */
export const draftBody = z.object({
  customerId: z.uuid().nullable(),
  issueDate: z.string(),
  dueDate: z.string(),
  notes: z.string().max(1_000).nullable().optional(),
  discount: z
    .object({ kind: z.enum(["percent", "fixed"]), value: z.string() })
    .nullable()
    .optional(),
  taxRate: z.string().optional(),
  allowPartial: z.boolean().default(false),
  reminders: z.boolean().default(true),
  repeat: z.enum(["weekly", "monthly"]).nullable().optional(),
  lines: z
    .array(z.object({ description: z.string(), quantity: z.string(), unitPrice: z.string() }))
    .max(50),
})

const bad = (field: string, message: string) => new HttpError(BAD_REQUEST, field, message)

export function toDraftInput(body: z.infer<typeof draftBody>): DraftInput {
  const lines = body.lines
    // A row with nothing typed in it is just the builder's next empty row.
    .filter((line) => line.description.trim() || line.unitPrice.trim())
    .map((line, i) => {
      const quantityMilli = parseQuantity(line.quantity || "1")
      if (quantityMilli === null) throw bad("lines", `Item ${i + 1}: quantity like 1 or 1.5`)
      const unitPrice = parseDollars(line.unitPrice || "0")
      if (unitPrice === null) throw bad("lines", `Item ${i + 1}: price in dollars and cents`)
      return { description: line.description, quantityMilli, unitPrice }
    })
  let discount: Discount = null
  if (body.discount?.value.trim()) {
    if (body.discount.kind === "percent") {
      const bp = parsePercent(body.discount.value)
      if (bp === null) throw bad("discount", "Discount is 0–100%")
      discount = bp > 0 ? { kind: "percent", bp } : null
    } else {
      const amount = parseDollars(body.discount.value)
      if (amount === null) throw bad("discount", "Discount in dollars and cents")
      discount = amount > 0n ? { kind: "fixed", amount } : null
    }
  }
  const taxBp = body.taxRate?.trim() ? parsePercent(body.taxRate) : 0
  if (taxBp === null) throw bad("tax", "Tax is 0–100%")
  return {
    customerId: body.customerId,
    issueDate: body.issueDate,
    dueDate: body.dueDate,
    notes: body.notes ?? null,
    discount,
    taxBp,
    allowPartial: body.allowPartial,
    reminders: body.reminders,
    repeat: body.repeat ?? null,
    lines,
  }
}

export const customerBody = z.object({
  name: z.string(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
})
