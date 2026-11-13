// Local money as people read it (plan 6.8 AC′): its own sign and two decimals (₦26,765.50, GH₵408.20, R312.60),
// the round flag for a country or currency, bank names in title case and account numbers grouped.

/** Round flag file (public/flags) for a currency. */
export const FIAT_FLAG: Record<string, string> = {
  NGN: "ng",
  GHS: "gh",
  ZAR: "za",
  EUR: "eu",
  USD: "us",
  GBP: "gb",
  KES: "ke",
}

export const FIAT_NAME: Record<string, string> = {
  NGN: "Naira",
  GHS: "Cedi",
  ZAR: "Rand",
  EUR: "Euro",
  USD: "US dollar",
  GBP: "Pound",
  KES: "Shilling",
}

/** "₦26,765.50": the currency's own sign, grouped, always two decimals. */
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

/** The currency's sign alone ("₦", "GH₵", "R"). */
export function fiatSign(fiat: string): string {
  return fiatMoney(fiat, 0).replace(/[\d.,\s]/g, "")
}

const KEEP = new Set([
  "UBA",
  "GTB",
  "FCMB",
  "ABSA",
  "PLC",
  "SA",
  "UK",
  "US",
  "EU",
  "NA",
  "LLC",
  "AG",
])
const WORD: Record<string, string> = {
  LTD: "Ltd",
  LIMITED: "Limited",
  OF: "of",
  AND: "and",
  THE: "the",
}

/** "OPENPAYD FINANCIAL SERVICES MALTA LTD" → "Openpayd Financial Services Malta Ltd"; mixed case is left alone. */
export function titleCase(name: string): string {
  if (/[a-z]/.test(name)) return name
  return name
    .split(/(\s+|\(|\))/)
    .map((word, i) => {
      if (!/[A-Z]/.test(word)) return word
      if (KEEP.has(word)) return word
      const mapped = WORD[word]
      if (mapped) return i === 0 ? mapped[0]?.toUpperCase() + mapped.slice(1) : mapped
      return word[0] + word.slice(1).toLowerCase()
    })
    .join("")
}

/** "0690000031" → "0690 000 031" (a Nigerian NUBAN); anything longer, an IBAN, in fours. */
export function groupNumber(value: string): string {
  const raw = value.replace(/\s+/g, "")
  if (/^\d{10}$/.test(raw)) return `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`
  return raw.replace(/(.{4})(?=.)/g, "$1 ")
}

/** "•• 0031" from a full number or a saved label. */
export function lastFour(value: string): string {
  const digits = value.replace(/\D/g, "")
  return digits.slice(-4)
}
