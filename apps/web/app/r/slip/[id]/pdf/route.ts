import { renderPayslipPdf } from "@tegata/documents"
import { serverEnv } from "@tegata/env"
import { payslipDocument } from "@tegata/services"

import { db } from "@/lib/server/context.ts"

/** The payslip as a PDF: made from the paid row on demand, so every paid row has one. Public by its random id. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const doc = await payslipDocument(db(), id, serverEnv().APP_URL)
  if (!doc) return new Response("Not found", { status: 404 })
  const pdf = await renderPayslipPdf(doc)
  const month = doc.payDate.slice(0, 7)
  const safe = (text: string) => text.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${doc.kind === "receipt" ? "Payment-receipt" : "Payslip"}-${safe(doc.business.name)}-${month}-${safe(doc.person.name)}.pdf"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  })
}
