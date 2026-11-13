// Bank payouts and bank details on the server (plan 6.8 AC): Noah's client from env, and the views the screens read.
import { noahClient } from "@tegata/core/noah"
import { serverEnv } from "@tegata/env"
import { BankError, type bankOverview } from "@tegata/services"

/** Noah's sandbox client; the key stays on the server. */
export function noah() {
  const key = serverEnv().NOAH_API_KEY
  if (!key) throw new BankError("not_live", "Bank payouts aren't set up on this server")
  return noahClient(key)
}

/** The address Noah watches: Tegata's Solana wallet (the Sandbox stand-in for NEAR Intents' hop). */
export function hopAddress() {
  const address = serverEnv().SOLANA_DEVNET_ADDRESS
  if (!address) throw new BankError("not_live", "Bank payouts aren't set up on this server")
  return address
}

type Overview = Awaited<ReturnType<typeof bankOverview>>

export function bankPayoutView(row: {
  payout: Overview["payouts"][number]["payout"]
  label: string
  holder?: string | null
}) {
  const { payout, label } = row
  return {
    id: payout.id,
    status: payout.status,
    amount: payout.amount.toString(),
    fiat: payout.fiat,
    fiatAmount: payout.fiatAmount,
    rate: payout.rate,
    fee: payout.fee,
    account: label,
    holder: row.holder ?? null,
    nearTx: payout.nearTx,
    hopTx: payout.hopTx && payout.hopTx !== "sending" ? payout.hopTx : null,
    error: payout.error,
    paidAt: payout.paidAt?.toISOString() ?? null,
    createdAt: payout.createdAt.toISOString(),
  }
}

export function bankOverviewView(o: Overview) {
  return {
    saved: o.saved.map((a) => ({
      id: a.id,
      country: a.country,
      fiat: a.fiat,
      label: a.label,
      holder: a.holder,
    })),
    payouts: o.payouts.map(bankPayoutView),
    details: o.details
      ? { fiat: o.details.fiat, ...o.details.details, createdAt: o.details.createdAt.toISOString() }
      : null,
    deposits: o.deposits.map((d) => ({
      id: d.id,
      fiat: d.fiat,
      fiatAmount: d.fiatAmount,
      amount: d.amount.toString(),
      status: d.status,
      creditTx: d.creditTx,
      error: d.error,
      createdAt: d.createdAt.toISOString(),
    })),
  }
}
