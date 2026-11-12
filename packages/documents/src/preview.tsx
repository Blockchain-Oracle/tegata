// The invoice email as HTML, for the builder's Email preview tab (loaded on demand in the browser).
import { render } from "@react-email/render"

import { InvoiceEmail, type InvoiceEmailData } from "./emails.tsx"

export function invoiceEmailHtml(data: InvoiceEmailData): Promise<string> {
  return render(<InvoiceEmail data={data} />)
}
