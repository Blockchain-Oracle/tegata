"use client"

// The invoice as a document: the business header (logo or
// seal), number and dates, From / To, the items, the totals, notes, and where it is paid. One component for the
// builder's live preview, the invoice page, and the public page, so all three always match. A paid invoice is
// stamped with the business's PAID seal. Paper stays light in both themes, so its colours are the paper tokens.
import { BusinessSeal, SealPress } from "@/components/brand/seal"
import { AccountLink } from "@/components/kit/account-link"
import { Figure, viewDollars } from "@/components/kit/figure"
import { SandboxPill } from "@/components/kit/sandbox-pill"
import { Mark, MarkStack } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { usdUnits } from "@/lib/fiat"
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
        "relative w-full overflow-hidden rounded-[20px] bg-paper text-[#16130F] shadow-receipt",
        p.className,
      )}
    >
      {p.stamp === "void" ? (
        // The paper stays light in both themes, so this is the light theme's red: the dark theme's is too pale for
        // white text.
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
            <span className="mt-1 font-mono text-[13px] text-paper-text-2">
              {p.number ?? "Draft"}
            </span>
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
              <span className="text-paper-text-3">Choose a customer</span>
            )}
          </Block>
        </div>

        <div className="flex flex-col">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-paper-rule pb-2 text-[12px] font-semibold text-paper-text-2 sm:grid-cols-[1fr_56px_96px_104px]">
            <span>Item</span>
            <span className="text-right max-sm:hidden">Qty</span>
            <span className="text-right max-sm:hidden">Price</span>
            <span className="col-span-2 text-right sm:col-span-1">Amount</span>
          </div>
          {p.lines.length === 0 ? (
            <span className="py-4 text-[14px] text-paper-text-3">Items appear here</span>
          ) : (
            p.lines.map((line, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity of their own in a preview.
                key={i}
                className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-paper-rule py-3 text-[14px] sm:grid-cols-[1fr_56px_96px_104px]"
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {line.description || <span className="text-paper-text-3">Item {i + 1}</span>}
                  <span className="block text-[12px] text-paper-text-2 sm:hidden">
                    {line.quantity} × {usdUnits(line.unitPrice)}
                  </span>
                </span>
                <span className="tnum text-right max-sm:hidden">{line.quantity}</span>
                <span className="tnum text-right max-sm:hidden">{usdUnits(line.unitPrice)}</span>
                <span className="tnum text-right font-semibold">{usdUnits(line.amount)}</span>
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
              <Total label="Subtotal">{usdUnits(p.subtotal)}</Total>
              {p.discount > 0n ? (
                <Total label={p.discountLabel ?? "Discount"}>−{usdUnits(p.discount)}</Total>
              ) : null}
              {p.tax > 0n ? <Total label={p.taxLabel ?? "Tax"}>{usdUnits(p.tax)}</Total> : null}
              <div className="mt-1 flex items-baseline justify-between border-t border-paper-rule pt-2">
                <dt className="font-semibold">Total</dt>
                <dd>
                  <Figure value={viewDollars(p.total)} className="text-[32px]" />
                </dd>
              </div>
              {p.stamp === "partly" && p.paidTotal ? (
                <>
                  <Total label="Paid">−{usdUnits(p.paidTotal)}</Total>
                  <Total label="Left to pay" strong>
                    {usdUnits(remaining > 0n ? remaining : 0n)}
                  </Total>
                </>
              ) : null}
            </dl>
          </div>
        </div>

        {p.notes ? (
          <p className="whitespace-pre-line rounded-[12px] bg-paper-sunk p-4 text-[13px] text-black">
            {p.notes}
          </p>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-paper-rule pt-4 text-[12px] text-paper-text-2">
          <span className="inline-flex flex-wrap items-center gap-2">
            <MarkStack ids={["usdc", "near"]} size={16} /> Pay in USDC on NEAR
            {p.sandbox ? (
              <SandboxPill className="border-paper-text-3 px-2.5 py-0.5 text-[12px] text-paper-text-2">
                Sandbox
              </SandboxPill>
            ) : null}
          </span>
          {p.payAddress ? (
            <span className="inline-flex items-center gap-1.5">
              <Mark id="near" size={12} /> <AccountLink accountId={p.payAddress} />
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
      <span className="text-[12px] font-semibold text-paper-text-2">{label}</span>
      <div className="min-w-0 text-[13px] [overflow-wrap:anywhere]">{children}</div>
    </div>
  )
}

function PartyLines({ party }: { party: Party }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-semibold">{party.name}</span>
      {party.address ? (
        <span className="whitespace-pre-line text-paper-text-2">{party.address}</span>
      ) : null}
      {party.taxId ? <span className="text-paper-text-2">Tax ID {party.taxId}</span> : null}
      {party.email ? (
        <span className="text-paper-text-2 [overflow-wrap:anywhere]">{party.email}</span>
      ) : null}
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
      <dt className="text-paper-text-2">{label}</dt>
      <dd className="tnum">{children}</dd>
    </div>
  )
}
