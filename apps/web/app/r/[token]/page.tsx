// A public receipt for a customer payment, read on the server straight from the database. Not indexed: it is
// shared, not searched. Sends and rewards have their own receipts at /r/send/<id> and /r/reward/<id>.
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ReceiptView } from "@/components/receipt/receipt-view"
import { paymentReceiptView } from "@/lib/server/receipts.ts"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const receipt = await paymentReceiptView((await params).token)
  if (!receipt) return { title: "Receipt not found", robots: { index: false } }
  return {
    title: `Receipt No. ${String(receipt.number).padStart(4, "0")} · ${receipt.business}`,
    robots: { index: false, follow: false },
  }
}

export default async function ReceiptPage({ params }: Props) {
  const { token } = await params
  const receipt = await paymentReceiptView(token)
  if (!receipt) notFound()
  return <ReceiptView receipt={receipt} token={token} />
}
