// The receipt for a send: what left the business, to whom, and the NEAR transaction. Public by its random id, so
// the sender can share it with the person they paid.
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ReceiptView } from "@/components/receipt/receipt-view"
import { sendReceiptView } from "@/lib/server/receipts.ts"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const receipt = await sendReceiptView((await params).id)
  if (!receipt) return { title: "Receipt not found", robots: { index: false } }
  return { title: `Sent · ${receipt.business}`, robots: { index: false, follow: false } }
}

export default async function SendReceiptPage({ params }: Props) {
  const { id } = await params
  const receipt = await sendReceiptView(id)
  if (!receipt) notFound()
  return <ReceiptView receipt={receipt} token={`send:${id}`} />
}
