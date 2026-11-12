// The public invoice, read on the server straight from the database. Not indexed: it is shared, not searched.
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PublicInvoice } from "@/components/invoices/public-invoice"

import { loadPublicInvoice } from "./load"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadPublicInvoice((await params).token)
  if (!data) return { title: "Invoice not found", robots: { index: false } }
  return {
    title: `${data.number} from ${data.from.name}`,
    description: `Invoice ${data.number} from ${data.from.name}. Pay in dollars from any chain; settled on NEAR.`,
    robots: { index: false, follow: false },
  }
}

export default async function PublicInvoicePage({ params }: Props) {
  const data = await loadPublicInvoice((await params).token)
  if (!data) notFound()
  return <PublicInvoice data={data} />
}
