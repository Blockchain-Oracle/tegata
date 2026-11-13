// Payouts to another chain as the screens see them (plan 6.8 AB).
import type { QuoteResponse } from "@tegata/core/oneclick"
import type { schema } from "@tegata/db"

type Payout = typeof schema.payouts.$inferSelect

export function payoutView(p: Payout) {
  return {
    id: p.id,
    status: p.status,
    swapStatus: p.swapStatus,
    amount: p.amount.toString(),
    symbol: p.symbol,
    chain: p.chain,
    recipient: p.recipient,
    amountOutFormatted: p.amountOutFormatted,
    txHash: p.txHash,
    destinationTx: p.destinationTx,
    error: p.error,
    deliveredAt: p.deliveredAt?.toISOString() ?? null,
    timeEstimate: (p.quote as QuoteResponse | null)?.quote.timeEstimate ?? null,
    createdAt: p.createdAt.toISOString(),
  }
}
