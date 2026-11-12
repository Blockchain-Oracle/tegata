import { USDC_DECIMALS } from "@tegata/config"

/**
 * Money is always a bigint in base units (USDC has 6 decimals: 1.00 = 1_000_000n).
 * It crosses the wire and the database as a decimal string, never as a number.
 */

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/

/** "12.5" → 12_500_000n for USDC. Throws on anything that is not a plain positive decimal. */
export function toUnits(amount: string, decimals: number = USDC_DECIMALS): bigint {
  const clean = amount.trim().replaceAll(",", "")
  if (!DECIMAL_PATTERN.test(clean)) throw new Error(`"${amount}" is not an amount`)
  const [whole = "0", fraction = ""] = clean.split(".")
  if (fraction.length > decimals) {
    throw new Error(`"${amount}" has more than ${decimals} decimal places`)
  }
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0")
}

/** 12_500_000n → "12.5". Trailing zeros are dropped; `minFraction` keeps cents ("12.50"). */
export function fromUnits(
  units: bigint,
  decimals: number = USDC_DECIMALS,
  minFraction = 0,
): string {
  const negative = units < 0n
  const absolute = negative ? -units : units
  const base = 10n ** BigInt(decimals)
  const whole = absolute / base
  let fraction = (absolute % base).toString().padStart(decimals, "0").replace(/0+$/, "")
  if (fraction.length < minFraction) fraction = fraction.padEnd(minFraction, "0")
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`
}

const CENTS = 2

/** 1234500000n → "1,234.50" for display. */
export function formatUsd(units: bigint, decimals: number = USDC_DECIMALS): string {
  const [whole = "0", fraction = ""] = fromUnits(units, decimals, CENTS).split(".")
  const negative = whole.startsWith("-")
  const digits = negative ? whole.slice(1) : whole
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${negative ? "-" : ""}${grouped}.${fraction}`
}
