"use client"

// Rolling money (21st barvian/number-flow 1444, ported from Senryo's Odometer): each digit rolls forward on a rise and
// back on a fall, 260 ms on cubic-bezier(0.22, 1, 0.36, 1), in the condensed display cut. Display only: money stays in
// bigint base units upstream and becomes a number only here.
import NumberFlow, { type Format } from "@number-flow/react"

import { cn } from "@/lib/utils"

const TIMING = { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" } as const
const UNITS_PER_DOLLAR = 1e6

/** USDC base units (6 decimals) → a float for the view. */
export const viewDollars = (units: bigint | string): number =>
  Number(BigInt(units)) / UNITS_PER_DOLLAR

export function Figure({
  value,
  signed = false,
  decimals = 2,
  className,
  plain = false,
}: {
  value: number
  /** Show + / − and colour by direction (money in / out). */
  signed?: boolean
  decimals?: number
  className?: string
  /** A count, not money. */
  plain?: boolean
}) {
  const safe = Number.isFinite(value) ? value : 0
  const format: Format = {
    ...(plain ? {} : { style: "currency", currency: "USD" }),
    minimumFractionDigits: plain ? 0 : decimals,
    maximumFractionDigits: plain ? 0 : decimals,
    signDisplay: signed ? "exceptZero" : "auto",
  }
  return (
    <span
      className={cn(
        "figure inline-flex whitespace-nowrap",
        signed && safe > 0 && "text-up",
        className,
      )}
    >
      <NumberFlow
        locales="en-US"
        value={safe}
        format={format}
        transformTiming={TIMING}
        spinTiming={TIMING}
        willChange
      />
    </span>
  )
}
