import { invoiceNumber, localToday, percentText, quantityText } from "@tegata/core/invoices"
import { logoPath, publicInvoice } from "@tegata/services"

import type { PublicInvoiceData } from "@/components/invoices/public-invoice"
import { db } from "@/lib/server/context.ts"

/** The public invoice as the page and the PDF need it: the document as sent, never a draft. */
export async function loadPublicInvoice(token: string): Promise<PublicInvoiceData | null> {
  const found = await publicInvoice(db(), token)
  if (!found) return null
  const { invoice, lines, business, receipts } = found
  return {
    token,
    number: invoiceNumber(invoice.number ?? 0),
    status: found.status,
    stored: invoice.status === "paid" ? "paid" : invoice.status === "void" ? "void" : "open",
    from: invoice.billFrom ?? {
      name: business.name,
      email: business.email,
      address: business.address,
      taxId: business.taxId,
    },
    logo: logoPath(business),
    to: invoice.billTo,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    lines: lines.map((line) => ({
      description: line.description,
      quantity: quantityText(line.quantityMilli),
      unitPrice: line.unitPrice.toString(),
      amount: line.amount.toString(),
    })),
    subtotal: invoice.subtotal.toString(),
    discount: invoice.discount.toString(),
    discountLabel:
      invoice.discountKind === "percent" && invoice.discountValue !== null
        ? `Discount ${percentText(Number(invoice.discountValue))}%`
        : "Discount",
    tax: invoice.tax.toString(),
    taxLabel: invoice.taxBp ? `Tax ${percentText(invoice.taxBp)}%` : null,
    total: invoice.total.toString(),
    paidTotal: found.paidTotal.toString(),
    remaining: found.remaining.toString(),
    notes: invoice.notes,
    receiverId: found.receiverId,
    sandbox: invoice.network === "testnet",
    today: localToday(business.timezone),
    receipts: receipts.map((r) => ({
      token: r.receiptToken,
      amount: r.amount.toString(),
      rail: r.rail,
      settledAt: r.settledAt?.toISOString() ?? null,
    })),
  }
}
