// Money as people read it, in emails. Mirrors apps/web/lib/fiat.ts (fiatMoney, usd, FIAT_FLAG and the coin
// precision of coinAmount): the documents package can't import from the web app, so keep the two in step.

/** "₦26,765.50", "€2.00", "$1,250.00": the currency's own sign, grouped, always two decimals. */
export function fiatMoney(fiat: string, amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount
  if (!Number.isFinite(value)) return "—"
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: fiat,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(value)
      .replace(/^([^\d\s-]+)\s+/, "$1")
  } catch {
    return `${value.toFixed(2)} ${fiat}`
  }
}

/** "$1,250.00": dollars, grouped, two decimals. */
export const usd = (dollars: number) => fiatMoney("USD", dollars)

/** USDC base units (6 decimals) as "$1,250.00". */
export const usdUnits = (units: bigint | string | number) => usd(Number(BigInt(units)) / 1_000_000)

/** Round flag PNG (public/email/flags) for a currency. */
export const FIAT_FLAG: Record<string, string> = {
  NGN: "ng",
  GHS: "gh",
  ZAR: "za",
  EUR: "eu",
  USD: "us",
  GBP: "gb",
  KES: "ke",
}

const COIN_DECIMALS: Record<string, number> = { BTC: 6, WBTC: 6, ETH: 5, SOL: 4, BNB: 4, NEAR: 3 }

/** "12.35", "0.004812": a coin amount at a sensible precision for its coin, grouped. */
export function coinFigure(amount: string | number, symbol: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount
  if (!Number.isFinite(value)) return String(amount)
  const decimals = COIN_DECIMALS[symbol.toUpperCase()] ?? 2
  return value.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(2, decimals),
    maximumFractionDigits: decimals,
  })
}
