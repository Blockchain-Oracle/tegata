"use client"

// The invoice as a document (plan 6.8 J–N, after Acctual's and Mercury's previews): the business header (logo or
// seal), number and dates, From / To, the items, the totals, notes, and where it is paid. One component for the
// builder's live preview, the invoice page, and the public page, so all three always match. A paid invoice is
// stamped with the business's PAID seal.
import { BusinessSeal, SealPress } from "@/components/brand/seal"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Mark, MarkStack } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

export interface Party {
  name: string
  email: string | null
  address: string | null
  taxId: string | null
}

export interface PaperLine {
  description: string
  /** As shown: "1.5". */
  quantity: string
  /** Base units. */
  unitPrice: bigint
  amount: bigint
}

export interface InvoicePaperProps {
  from: Party
  logo: string | null
  to: Party | null
  /** "INV-0007", or null for a draft. */
  number: string | null
  issueDate: string
  dueDate: string
  lines: PaperLine[]
  subtotal: bigint
  discount: bigint
  discountLabel: string | null
  tax: bigint
  taxLabel: string | null
  total: bigint
  notes: string | null
  payAddress: string | null
  sandbox: boolean
  stamp?: "paid" | "partly" | "void" | null
  paidTotal?: bigint
  /** Press the PAID seal once (a payment just landed). */
  pressSeal?: boolean
  className?: string
}

const money = (units: bigint) =>
  viewDollars(units).toLocaleString("en-US", { style: "currency", currency: "USD" })

export const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

export function InvoicePaper(p: InvoicePaperProps) {
  const remaining = p.total - (p.paidTotal ?? 0n)
  return (
    <article
      className={cn(
        "relative w-full overflow-hidden rounded-[20px] bg-white text-black shadow-receipt",
        p.className,
      )}
    >
      {p.stamp === "void" ? (
        <div className="bg-[#C8283F] px-5 py-2 text-center text-[13px] font-semibold text-white">
          This invoice was cancelled
        </div>
      ) : null}
      <div className="flex flex-col gap-6 p-5 sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {p.logo ? (
              <img src={p.logo} alt="" className="size-12 shrink-0 rounded-[12px] object-cover" />
            ) : (
              <BusinessSeal name={p.from.name} size={48} tilt={0} />
            )}
            <span className="truncate text-[17px] font-semibold">
              {p.from.name || "Your business"}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="display text-[30px] leading-none">Invoice</span>
            <span className="mt-1 font-mono text-[13px] text-[#666]">{p.number ?? "Draft"}</span>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 text-[13px]">
          <Block label="Issued">{longDate(p.issueDate)}</Block>
          <Block label="Due">{longDate(p.dueDate)}</Block>
          <Block label="From">
            <PartyLines party={p.from} />
          </Block>
          <Block label="Bill to">
            {p.to ? (
              <PartyLines party={p.to} />
            ) : (
              <span className="text-[#999]">Choose a customer</span>
            )}
          </Block>
        </div>

        <div className="flex flex-col">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-[#ECECEC] pb-2 text-[12px] font-semibold text-[#666] sm:grid-cols-[1fr_56px_96px_104px]">
            <span>Item</span>
            <span className="text-right max-sm:hidden">Qty</span>
            <span className="text-right max-sm:hidden">Price</span>
            <span className="col-span-2 text-right sm:col-span-1">Amount</span>
          </div>
          {p.lines.length === 0 ? (
            <span className="py-4 text-[14px] text-[#999]">Items appear here</span>
          ) : (
            p.lines.map((line, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity of their own in a preview.
                key={i}
                className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-[#F2F2F2] py-3 text-[14px] sm:grid-cols-[1fr_56px_96px_104px]"
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {line.description || <span className="text-[#999]">Item {i + 1}</span>}
                  <span className="block text-[12px] text-[#666] sm:hidden">
                    {line.quantity} × {money(line.unitPrice)}
                  </span>
                </span>
                <span className="tnum text-right max-sm:hidden">{line.quantity}</span>
                <span className="tnum text-right max-sm:hidden">{money(line.unitPrice)}</span>
                <span className="tnum text-right font-semibold">{money(line.amount)}</span>
              </div>
            ))
          )}
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            {p.stamp === "paid" ? (
              <SealPress
                play={p.pressSeal ?? false}
                delay={0.3}
                onLanded={() => fire("filled", { cue: "stamp" })}
                className="pointer-events-none max-sm:order-2"
              >
                <BusinessSeal name={p.from.name} band="Paid" size={104} tilt={-8} />
              </SealPress>
            ) : (
              <span />
            )}
            <dl className="ml-auto flex w-full max-w-[280px] flex-col gap-1.5 text-[14px]">
              <Total label="Subtotal">{money(p.subtotal)}</Total>
              {p.discount > 0n ? (
                <Total label={p.discountLabel ?? "Discount"}>−{money(p.discount)}</Total>
              ) : null}
              {p.tax > 0n ? <Total label={p.taxLabel ?? "Tax"}>{money(p.tax)}</Total> : null}
              <div className="mt-1 flex items-baseline justify-between border-t border-[#ECECEC] pt-2">
                <dt className="font-semibold">Total</dt>
                <dd>
                  <Figure value={viewDollars(p.total)} className="text-[32px]" />
                </dd>
              </div>
              {p.stamp === "partly" && p.paidTotal ? (
                <>
                  <Total label="Paid">−{money(p.paidTotal)}</Total>
                  <Total label="Left to pay" strong>
                    {money(remaining > 0n ? remaining : 0n)}
                  </Total>
                </>
              ) : null}
            </dl>
          </div>
        </div>

        {p.notes ? (
          <p className="whitespace-pre-line rounded-[12px] bg-[#F5F5F5] p-4 text-[13px] text-[#444]">
            {p.notes}
          </p>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-[#ECECEC] pt-4 text-[12px] text-[#666]">
          <span className="inline-flex items-center gap-2">
            <MarkStack ids={["usdc", "near"]} size={16} /> Pay in USDC on NEAR
            {p.sandbox ? " · Sandbox" : ""}
          </span>
          {p.payAddress ? (
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Mark id="near" size={12} /> {p.payAddress}
            </span>
          ) : null}
        </footer>
      </div>
    </article>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[12px] font-semibold text-[#666]">{label}</span>
      <div className="min-w-0 text-[13px] [overflow-wrap:anywhere]">{children}</div>
    </div>
  )
}

function PartyLines({ party }: { party: Party }) {
  return (
    <span className="flex flex-col">
      <span className="font-semibold">{party.name}</span>
      {party.address ? (
        <span className="whitespace-pre-line text-[#444]">{party.address}</span>
      ) : null}
      {party.taxId ? <span className="text-[#444]">Tax ID {party.taxId}</span> : null}
      {party.email ? <span className="text-[#444]">{party.email}</span> : null}
    </span>
  )
}

function Total({
  label,
  children,
  strong,
}: {
  label: string
  children: React.ReactNode
  strong?: boolean
}) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "font-semibold")}>
      <dt className="text-[#666]">{label}</dt>
      <dd className="tnum">{children}</dd>
    </div>
  )
}
