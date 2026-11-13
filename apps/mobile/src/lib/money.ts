// Money stays a bigint in USDC base units (6 decimals) until it is drawn. One formatter for every figure on the phone:
// "$1,234.50", thousands grouped, cents always shown, the sign written out.
const DECIMALS = 6
const BASE = 10n ** BigInt(DECIMALS)

export function toUnits(amount: string): bigint {
  const clean = amount.trim().replaceAll(",", "")
  if (!/^\d+(\.\d+)?$/.test(clean)) throw new Error(`"${amount}" is not an amount`)
  const [whole = "0", fraction = ""] = clean.split(".")
  if (fraction.length > DECIMALS) throw new Error("Too many decimal places")
  return BigInt(whole) * BASE + BigInt(fraction.padEnd(DECIMALS, "0") || "0")
}

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

/** 1234500000n → "$1,234.50"; `signed` writes "+$" / "−$". Cents are rounded down (money never rounds up). */
export function usd(
  units: bigint | string | null | undefined,
  options: { signed?: boolean } = {},
): string {
  const value = BigInt(units ?? 0)
  const negative = value < 0n
  const abs = negative ? -value : value
  const whole = abs / BASE
  const cents = (abs % BASE) / 10_000n
  const body = `$${group(whole.toString())}.${cents.toString().padStart(2, "0")}`
  if (negative) return `−${body}`
  return options.signed && value > 0n ? `+${body}` : body
}

/** Base units → a float for animation only. */
export const dollars = (units: bigint | string | null | undefined) =>
  Number(BigInt(units ?? 0)) / 1e6

/** What a keypad shows while typing: "1,250.5" with grouping, no forced cents. */
export function typedAmount(raw: string): string {
  if (!raw) return "0"
  const [whole = "0", fraction] = raw.split(".")
  return `${group(whole || "0")}${fraction === undefined ? "" : `.${fraction}`}`
}

/** "25.5" is a valid amount above zero. */
export function amountOk(raw: string) {
  try {
    return toUnits(raw) > 0n
  } catch {
    return false
  }
}
