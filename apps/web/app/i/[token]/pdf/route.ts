import { renderInvoicePdf } from "@tegata/documents"
import { invoiceDocuments } from "@tegata/services"

import { db } from "@/lib/server/context.ts"

/** The invoice as a PDF: the same document the customer opens, for printing, filing and the email attachment. */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const docs = await invoiceDocuments(db(), token, new URL(request.url).origin)
  if (!docs) return new Response("Not found", { status: 404 })
  const pdf = await renderInvoicePdf(docs.document)
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${docs.document.number}.pdf"`,
      "cache-control": "private, no-store",
    },
  })
}
