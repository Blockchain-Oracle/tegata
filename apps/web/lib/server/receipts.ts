// Every money movement as the one receipt the app shows: a customer payment (numbered, /r/<token>), a send
// (/r/send/<id>) and a referral reward (/r/reward/<id>). Each receipt links to its NEAR transaction last.
import { explorerTx } from "@tegata/core/near"
import { receiptByToken, rewardReceipt, sendReceipt } from "@tegata/services"

import type { ReceiptView } from "@/lib/client/types"

import { db } from "./context.ts"

export async function paymentReceiptView(token: string): Promise<ReceiptView | null> {
  const row = await receiptByToken(db(), token)
  if (!row) return null
  const { receipt, payment, request, business, logo } = row
  return {
    kind: "payment",
    number: receipt.number,
    business,
    logo,
    title: request.title,
    amount: payment.amount.toString(),
    method: payment.rail,
    payer: payment.payer,
    payerName: null,
    receiverName: business,
    receiverId: payment.receiverId,
    network: payment.network,
    settledAt: payment.settledAt?.toISOString() ?? null,
    feeBy: payment.rail === "manual" ? null : payment.rail === "tegata" ? "tegata" : "payer",
    txHash: payment.txHash,
    explorerUrl: payment.txHash ? explorerTx(payment.network, payment.txHash) : null,
  }
}

export async function sendReceiptView(id: string): Promise<ReceiptView | null> {
  const row = await sendReceipt(db(), id)
  if (!row) return null
  const { relay } = row
  return {
    kind: "send",
    number: null,
    business: row.business,
    logo: row.logo,
    title: "One-off payment",
    amount: row.amount.toString(),
    method: "tegata",
    payer: relay.senderId,
    payerName: row.business,
    receiverName: row.to,
    receiverId: row.to,
    network: relay.network,
    settledAt: row.settled ? relay.updatedAt.toISOString() : null,
    feeBy: "tegata",
    txHash: relay.txHash,
    explorerUrl: relay.txHash ? explorerTx(relay.network, relay.txHash) : null,
  }
}

export async function rewardReceiptView(id: string): Promise<ReceiptView | null> {
  const row = await rewardReceipt(db(), id)
  if (!row) return null
  const { payout } = row
  return {
    kind: "reward",
    number: null,
    business: "Tegata",
    logo: null,
    title:
      payout.side === "referrer"
        ? `Referral reward for inviting ${row.other}`
        : `Referral reward for joining through ${row.other}`,
    amount: payout.amount.toString(),
    method: "reward",
    payer: row.operator,
    payerName: "Tegata",
    receiverName: row.receiver,
    receiverId: payout.accountId,
    network: row.network,
    settledAt: payout.updatedAt.toISOString(),
    feeBy: "tegata",
    txHash: payout.txHash,
    explorerUrl: payout.txHash ? explorerTx(row.network, payout.txHash) : null,
  }
}
