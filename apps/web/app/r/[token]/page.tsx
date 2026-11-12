// A public receipt, read on the server straight from the database. Not indexed: it is shared, not searched.
import { explorerTx } from "@tegata/core/near"
import { receiptByToken } from "@tegata/services"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ReceiptView } from "@/components/receipt/receipt-view"
import type { ReceiptView as Receipt } from "@/lib/client/types"
import { db } from "@/lib/server/context.ts"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

async function load(token: string): Promise<Receipt | null> {
  const row = await receiptByToken(db(), token)
  if (!row) return null
  const { receipt, payment, request, business } = row
  return {
    number: receipt.number,
    business,
    title: request.title,
    amount: payment.amount.toString(),
    rail: payment.rail,
    payer: payment.payer,
    receiverId: payment.receiverId,
    network: payment.network,
    settledAt: payment.settledAt?.toISOString() ?? null,
    txHash: payment.txHash,
    explorerUrl: payment.txHash ? explorerTx(payment.network, payment.txHash) : null,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const receipt = await load((await params).token)
  if (!receipt) return { title: "Receipt not found", robots: { index: false } }
  return {
    title: `Receipt No. ${String(receipt.number).padStart(4, "0")} · ${receipt.business}`,
    robots: { index: false, follow: false },
  }
}

export default async function ReceiptPage({ params }: Props) {
  const { token } = await params
  const receipt = await load(token)
  if (!receipt) notFound()
  return <ReceiptView receipt={receipt} token={token} />
}
