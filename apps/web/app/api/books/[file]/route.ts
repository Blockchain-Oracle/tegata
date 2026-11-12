import { renderStatementPdf } from "@tegata/documents"
import { serverEnv } from "@tegata/env"

import { requireOwner } from "@/lib/server/auth.ts"
import { booksCsv, monthOf, parseMonth, statementDocument } from "@/lib/server/books.ts"
import { notFound, route } from "@/lib/server/http.ts"

/** `2026-11.csv` (for an accountant) or `2026-11.pdf` (the monthly statement). */
export const GET = route(async (request, context: { params: Promise<{ file: string }> }) => {
  const { user, workspace } = await requireOwner(request)
  const [name, ext] = (await context.params).file.split(".")
  const month = parseMonth(name ?? "", workspace.timezone)
  const slug =
    workspace.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "tegata"
  if (ext === "csv") {
    const { list } = await monthOf(user, workspace, month)
    return new Response(booksCsv(list, workspace.timezone, serverEnv().APP_URL), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${slug}-${month}.csv"`,
      },
    })
  }
  if (ext === "pdf") {
    const pdf = await renderStatementPdf(await statementDocument(user, workspace, month))
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${slug}-statement-${month}.pdf"`,
      },
    })
  }
  throw notFound()
})
