/**
 * Invoice maths (plan 6.8 J–N, "Money rules"). Everything is USDC base units as bigint, and every money value is a
 * whole number of cents, so an invoice for 500.00 is paid as exactly 500.00.
 *
 *   line      = quantity × unit price, rounded half-up to the cent (quantity allows three decimals: hours)
 *   discount  = a percent of the subtotal (rounded to the cent) or a fixed amount, never more than the subtotal
 *   tax       = one rate on (subtotal − discount), rounded to the cent; prices exclude tax
 *   total     = subtotal − discount + tax
 */

/** USDC base units in one cent (6 decimals). */
export const CENT = 10_000n
/** Quantities are stored ×1000 so "1.5 hours" is exact. */
export const QTY_SCALE = 1_000n
/** Percentages are stored in basis points: 7.5% = 750. */
export const BP = 10_000n

export const INVOICE_LIMITS = {
  lines: 50,
  description: 200,
  /** 1,000,000 units of anything. */
  maxQuantityMilli: 1_000_000n * QTY_SCALE,
  /** $1,000,000 a line. */
  maxUnitPrice: 1_000_000n * 100n * CENT,
  maxTaxBp: 10_000,
  notes: 1_000,
} as const

export interface LineMoney {
  /** Quantity × 1000. */
  quantityMilli: bigint
  /** Unit price in base units, whole cents. */
  unitPrice: bigint
}

export type Discount = { kind: "percent"; bp: number } | { kind: "fixed"; amount: bigint } | null

export interface Totals {
  lines: bigint[]
  subtotal: bigint
  discount: bigint
  tax: bigint
  total: bigint
}

/** a / b rounded half-up, for non-negative values. */
function divRound(a: bigint, b: bigint): bigint {
  return (a + b / 2n) / b
}

export function lineAmount(line: LineMoney): bigint {
  return divRound(line.quantityMilli * line.unitPrice, QTY_SCALE * CENT) * CENT
}

export function invoiceTotals(
  lines: readonly LineMoney[],
  discount: Discount,
  taxBp: number,
): Totals {
  const amounts = lines.map(lineAmount)
  const subtotal = amounts.reduce((sum, amount) => sum + amount, 0n)
  const off =
    discount === null
      ? 0n
      : discount.kind === "percent"
        ? divRound(subtotal * BigInt(discount.bp), BP * CENT) * CENT
        : discount.amount
  // biome-ignore lint/complexity/useMathMinMax: bigint money; Math.min would coerce and throw.
  const discountApplied = off > subtotal ? subtotal : off
  const taxable = subtotal - discountApplied
  const tax = divRound(taxable * BigInt(taxBp), BP * CENT) * CENT
  return { lines: amounts, subtotal, discount: discountApplied, tax, total: taxable + tax }
}

const QUANTITY = /^\d+(\.\d{1,3})?$/
const PERCENT = /^\d+(\.\d{1,2})?$/
const DOLLARS = /^\d+(\.\d{1,2})?$/

/** "1.5" → 1500n. Null when it isn't a positive quantity with at most three decimals. */
export function parseQuantity(text: string): bigint | null {
  const clean = text.trim()
  if (!QUANTITY.test(clean)) return null
  const [whole = "0", fraction = ""] = clean.split(".")
  const milli = BigInt(whole) * QTY_SCALE + BigInt(fraction.padEnd(3, "0"))
  return milli > 0n && milli <= INVOICE_LIMITS.maxQuantityMilli ? milli : null
}

/** "7.5" → 750 basis points. Null unless 0–100 with at most two decimals. */
export function parsePercent(text: string): number | null {
  const clean = text.trim()
  if (!PERCENT.test(clean)) return null
  const [whole = "0", fraction = ""] = clean.split(".")
  const bp = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  return bp <= INVOICE_LIMITS.maxTaxBp ? bp : null
}

/** "12.50" → base units. Null unless dollars with at most two decimals (whole cents). */
export function parseDollars(text: string): bigint | null {
  const clean = text.trim().replaceAll(",", "")
  if (!DOLLARS.test(clean)) return null
  const [whole = "0", fraction = ""] = clean.split(".")
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))) * CENT
}

/** 1500n → "1.5" for a form field. */
export function quantityText(milli: bigint): string {
  const whole = milli / QTY_SCALE
  const fraction = (milli % QTY_SCALE).toString().padStart(3, "0").replace(/0+$/, "")
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

/** 750 → "7.5". */
export function percentText(bp: number): string {
  const whole = Math.floor(bp / 100)
  const fraction = String(bp % 100)
    .padStart(2, "0")
    .replace(/0+$/, "")
  return fraction ? `${whole}.${fraction}` : String(whole)
}

/** INV-0001. */
export const invoiceNumber = (n: number) => `INV-${String(n).padStart(4, "0")}`
export * from "./schedule.ts"
