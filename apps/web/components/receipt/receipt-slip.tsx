"use client"

// One slip for every paid moment: the receipt page and the pay page's paid step draw the same paper. A
// header line by the Tegata seal, the amount in display figures, who it was for, a perforation, the facts, NEAR's
// footer, and the seal pressed in the corner. Paper stays light in both themes, so it uses the paper tokens.
import { TegataSeal } from "@/components/brand/seal"
import { Figure } from "@/components/kit/figure"
import { Mark } from "@/components/marks/mark"
import { cn } from "@/lib/utils"

export function ReceiptSlip({
  label,
  amount,
  sub,
  children,
  seal,
  notch = "bg-stage print:bg-white",
  className,
}: {
  /** "Receipt · No. 0007", "Paid", "Payslip". */
  label: React.ReactNode
  /** Dollars. */
  amount: number
  /** The line under the amount: the business, or what the dollars are. */
  sub?: React.ReactNode
  /** The facts, as `SlipRow`s. */
  children: React.ReactNode
  /** The seal pressed in the top corner. */
  seal?: React.ReactNode
  /** The colour behind the slip, for the perforation's notches. */
  notch?: string
  className?: string
}) {
  return (
    <article
      className={cn("relative rounded-[20px] bg-white text-black shadow-receipt", className)}
    >
      <div className="p-6 pb-4">
        <span className="flex items-center gap-2 pr-24 text-[13px] font-semibold text-paper-text-2">
          <TegataSeal size={20} textured={false} /> {label}
        </span>
        <Figure value={amount} className="mt-3 flex text-[56px] sm:text-[60px]" />
        {sub ? (
          <div className="mt-1 flex items-center gap-1.5 text-[14px] font-medium text-paper-text-2">
            {sub}
          </div>
        ) : null}
      </div>
      <div className="relative h-4" aria-hidden>
        <span
          className={cn("absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full", notch)}
        />
        <span
          className={cn("absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full", notch)}
        />
        <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-paper-rule" />
      </div>
      <dl className="flex flex-col gap-3 p-6 pt-3 text-[14px]">{children}</dl>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-paper-rule px-6 py-4 text-[12px] font-medium text-paper-text-2">
        <span className="inline-flex items-center gap-1.5">
          <Mark id="near" size={14} /> Settled on NEAR
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Mark id="intents" size={14} /> Powered by NEAR Intents
        </span>
      </div>
      {seal ? <div className="absolute top-4 right-4">{seal}</div> : null}
    </article>
  )
}

/** One fact on the slip: the label quiet on the left, the value on the right. */
export function SlipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-paper-text-2">{label}</dt>
      <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

/** "USDT on Tron → USDC on NEAR", each side with its real mark. */
export function RouteLine({
  coin,
  chainMark,
  from,
}: {
  coin: string
  chainMark: string
  /** "USDT on Tron". */
  from: string
}) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
      <span className="inline-flex items-center gap-1.5">
        <Mark id={coin} chain={chainMark} size={18} /> {from}
      </span>
      <span aria-hidden className="text-paper-text-3">
        →
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Mark id="usdc" chain="near" size={18} /> USDC on NEAR
      </span>
    </span>
  )
}
