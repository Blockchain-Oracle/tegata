/** @jsxRuntime automatic */
/** @jsxImportSource react */
// The invoice email as HTML, for the builder's Email preview tab (loaded on demand in the browser): the same layout and
// words the customer gets.
import { render } from "@react-email/render"

import { compose, type InvoiceData } from "./email/catalog.ts"
import { TegataEmail } from "./email/layout.tsx"

export function invoiceEmailHtml(data: InvoiceData, assets = ""): Promise<string> {
  return render(<TegataEmail content={compose({ kind: "invoice.sent", data }, assets)} />)
}

/** Any Tegata email as HTML and its subject, for /dev/emails. */
export async function emailHtml(event: import("./email/catalog.ts").EmailEvent, assets: string) {
  const content = compose(event, assets)
  return { subject: content.subject, html: await render(<TegataEmail content={content} />) }
}
