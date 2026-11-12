// The receipt for a referral reward Tegata paid: to whom, for which invite, and the NEAR transaction.
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ReceiptView } from "@/components/receipt/receipt-view"
import { rewardReceiptView } from "@/lib/server/receipts.ts"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const receipt = await rewardReceiptView((await params).id)
  if (!receipt) return { title: "Receipt not found", robots: { index: false } }
  return {
    title: `Referral reward · ${receipt.receiverName}`,
    robots: { index: false, follow: false },
  }
}

export default async function RewardReceiptPage({ params }: Props) {
  const { id } = await params
  const receipt = await rewardReceiptView(id)
  if (!receipt) notFound()
  return <ReceiptView receipt={receipt} token={`reward:${id}`} />
}
