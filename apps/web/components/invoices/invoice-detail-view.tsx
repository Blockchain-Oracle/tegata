"use client"

// One invoice (plan 6.8 L; Stripe's invoice page): the document on the stage, stamped when paid; beside it what is
// received and left, the actions, the payments (each opens its receipt) and the timeline of everything that
// happened. Separate from its logic so /dev/flows can show every state.
import { quantityText } from "@tegata/core/invoices"
import {
  ArrowLeft,
  Ban,
  Bell,
  Check,
  Copy,
  CopyPlus,
  ExternalLink,
  Eye,
  FilePlus2,
  HandCoins,
  Mail,
  ReceiptText,
  Send,
  Share2,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Stage } from "@/components/kit/stage"
import { ErrorState, Skeleton } from "@/components/kit/states"
import { RailMark } from "@/components/links/link-detail-view"
import { Sheet } from "@/components/shell/sheet"
import type { InvoiceDetail, InvoiceEvent } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

import { InvoicePaper } from "./invoice-paper"
import { invoiceLabel } from "./invoices-view"
import { dueText, InvoiceStatusPill } from "./status"

const COPIED_MS = 1500

export interface InvoiceDetailViewProps {
  detail: InvoiceDetail | undefined
  error: boolean
  onRetry: () => void
  logo: string | null
  today: string
  /** The public invoice page's full URL. */
  url: string | null
  justSent: boolean
  /** Paid while this page was open: press the PAID seal. */
  pressSeal: boolean
  busy: "void" | "paid" | "duplicate" | null
  problem: string | null
  onVoid: () => void
  onMarkPaid: (amount: string, note: string) => void
  onDuplicate: () => void
}

export function InvoiceDetailView(p: InvoiceDetailViewProps) {
  const [copied, setCopied] = useState(false)
  const [sheet, setSheet] = useState<"paid" | "void" | null>(null)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const d = p.detail
  const inv = d?.invoice
  const label = invoiceLabel(inv?.number ?? null)
  const open = inv?.status === "open"

  const copy = async () => {
    if (!p.url) return
    await navigator.clipboard.writeText(p.url)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }
  const share = async () => {
    if (!p.url || !inv) return
    if (navigator.share)
      await navigator
        .share({ title: `${label} from ${inv.billFrom?.name ?? ""}`, url: p.url })
        .catch(() => undefined)
    else await copy()
  }

  if (p.error)
    return (
      <ErrorState
        title="Couldn't load this invoice"
        detail="Its link still works for your customer."
        onRetry={p.onRetry}
      />
    )
  if (!d || !inv)
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Loading the invoice">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="h-[620px] rounded-[24px]" />
          <Skeleton className="h-[420px] rounded-[24px]" />
        </div>
      </div>
    )

  const total = BigInt(inv.total)
  const paid = BigInt(d.paidTotal)
  const progress = total > 0n ? Math.min(100, Number((paid * 100n) / total)) : 0
  const discountLabel =
    inv.discountKind === "percent" && inv.discountValue
      ? `Discount ${Number(inv.discountValue) / 100}%`
      : "Discount"

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href="/app/invoices"
          className="press grid size-10 shrink-0 place-items-center rounded-full bg-secondary hover:bg-plate-pressed"
          aria-label="All invoices"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="display font-mono text-page-title">{label}</h1>
        <InvoiceStatusPill status={d.status} />
        <span
          className={cn(
            "text-[15px] text-muted-foreground",
            d.status === "overdue" && "font-medium text-down",
          )}
        >
          {dueText(d.status, inv.dueDate, p.today, inv.paidAt)}
        </span>
      </header>

      {p.justSent && open ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-shu-wash px-5 py-4">
          <span className="flex items-center gap-3 text-[15px] font-medium text-shu-ink">
            <Send className="size-5" /> {label} is on its way to {inv.billTo?.name}. Share its link
            to get paid.
          </span>
          <Button size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Stage className="p-3 sm:p-6" grid={false}>
          <InvoicePaper
            from={inv.billFrom ?? { name: "", email: null, address: null, taxId: null }}
            logo={p.logo}
            to={inv.billTo}
            number={label}
            issueDate={inv.issueDate}
            dueDate={inv.dueDate}
            lines={d.lines.map((line) => ({
              description: line.description,
              quantity: quantityText(BigInt(line.quantityMilli)),
              unitPrice: BigInt(line.unitPrice),
              amount: BigInt(line.amount),
            }))}
            subtotal={BigInt(inv.subtotal)}
            discount={BigInt(inv.discount)}
            discountLabel={discountLabel}
            tax={BigInt(inv.tax)}
            taxLabel={inv.taxBp ? `Tax ${inv.taxBp / 100}%` : null}
            total={total}
            notes={inv.notes}
            payAddress={null}
            sandbox={inv.network === "testnet"}
            stamp={
              inv.status === "paid"
                ? "paid"
                : inv.status === "void"
                  ? "void"
                  : paid > 0n
                    ? "partly"
                    : null
            }
            paidTotal={paid}
            pressSeal={p.pressSeal}
          />
        </Stage>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-[20px] bg-card p-5">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-detail font-medium text-muted-foreground">Received</span>
                <Figure value={viewDollars(paid)} className="text-[34px]" />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-detail font-medium text-muted-foreground">
                  {inv.status === "void" ? "Cancelled" : "Left to pay"}
                </span>
                <Figure value={viewDollars(d.remaining)} className="text-[22px]" />
              </div>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Paid so far"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  inv.status === "paid" ? "bg-up" : "bg-shu",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-detail text-muted-foreground">
              of ${viewDollars(total).toFixed(2)}
              {inv.allowPartial ? " · part-payments allowed" : ""}
            </span>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <Action
              icon={copied ? <Check /> : <Copy />}
              label={copied ? "Copied" : "Copy link"}
              onClick={copy}
              disabled={!p.url}
            />
            <Action icon={<Share2 />} label="Share" onClick={share} disabled={!p.url} />
            <Action icon={<ExternalLink />} label="Open as customer" href={p.url ?? undefined} />
            <Action
              icon={<CopyPlus />}
              label="Duplicate"
              onClick={p.onDuplicate}
              busy={p.busy === "duplicate"}
            />
            {open ? (
              <>
                <Action
                  icon={<HandCoins />}
                  label="Mark paid by hand"
                  onClick={() => {
                    setAmount(viewDollars(d.remaining).toFixed(2))
                    setNote("")
                    setSheet("paid")
                  }}
                />
                <Action icon={<Ban />} label="Void" tone="down" onClick={() => setSheet("void")} />
              </>
            ) : null}
          </section>
          {p.problem ? <p className="text-[15px] font-medium text-down">{p.problem}</p> : null}

          {d.payments.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-section-title font-semibold">Payments</h2>
              <div className="flex flex-col rounded-[20px] bg-card p-2">
                {d.payments
                  .filter((pay) => pay.status === "succeeded")
                  .map((pay) => (
                    <Link
                      key={pay.id}
                      href={pay.receiptToken ? `/r/${pay.receiptToken}` : "#"}
                      className="press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
                    >
                      <RailMark rail={pay.rail} size={36} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-mono text-[14px] font-medium">
                          {pay.rail === "manual"
                            ? (pay.payer ?? "Paid by hand")
                            : (pay.payer ?? "Payer")}
                        </span>
                        <span className="text-detail text-muted-foreground">
                          {new Date(pay.settledAt ?? pay.createdAt).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                      <span className="tnum text-[15px] font-semibold text-up">
                        +${viewDollars(pay.amount).toFixed(2)}
                      </span>
                      <ReceiptText className="size-4 text-text-3" />
                    </Link>
                  ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <h2 className="text-section-title font-semibold">Timeline</h2>
            <ol className="flex flex-col rounded-[20px] bg-card p-4">
              {[...d.events].reverse().map((event, i, all) => (
                <TimelineItem key={event.id} event={event} last={i === all.length - 1} />
              ))}
            </ol>
          </section>
        </div>
      </div>

      <Sheet
        open={sheet === "paid"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Mark paid by hand"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            p.onMarkPaid(amount, note)
            setSheet(null)
          }}
        >
          <p className="text-[15px] text-muted-foreground">
            For money that reached you outside Tegata, like a bank transfer or cash. It counts
            toward this invoice and gets a receipt that says it isn't on NEAR.
          </p>
          <Field
            id="paid-amount"
            label="Amount received"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            leading={<span className="figure text-[22px] text-muted-foreground">$</span>}
            className="tnum"
          />
          <Field
            id="paid-note"
            label="How it was paid (optional)"
            placeholder="Bank transfer, ref 4471"
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" busy={p.busy === "paid"} disabled={!Number(amount)}>
            Record ${Number(amount || 0).toFixed(2)}
          </Button>
        </form>
      </Sheet>

      <Sheet
        open={sheet === "void"}
        onOpenChange={(o) => !o && setSheet(null)}
        title={`Void ${label}?`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-[15px] text-muted-foreground">
            Its link stops taking payments{inv.scheduleId ? " and the repeat stops" : ""}.{" "}
            {paid > 0n
              ? `The $${viewDollars(paid).toFixed(2)} already received stays in your balance.`
              : "Nothing has been paid on it."}{" "}
            You can't undo this; duplicate it to send a corrected copy.
          </p>
          <Button
            variant="destructive"
            busy={p.busy === "void"}
            onClick={() => {
              p.onVoid()
              setSheet(null)
            }}
          >
            Void invoice
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function Action({
  icon,
  label,
  onClick,
  href,
  disabled,
  busy,
  tone,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  busy?: boolean
  tone?: "down"
}) {
  const cls = cn(
    "press flex h-12 items-center gap-2.5 rounded-[14px] bg-card px-4 text-[15px] font-semibold disabled:opacity-40 [&_svg]:size-[18px]",
    tone === "down" ? "text-down" : "text-foreground",
  )
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {icon} {label}
      </a>
    )
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {icon} {label}
    </button>
  )
}

const EVENT: Record<
  InvoiceEvent["kind"],
  { icon: React.ReactNode; text: (e: InvoiceEvent) => string }
> = {
  created: {
    icon: <FilePlus2 />,
    text: (e) => (e.detail?.from ? `Drafted from ${e.detail.from}` : "Drafted"),
  },
  sent: { icon: <Send />, text: (e) => `Sent as ${e.detail?.number ?? "an invoice"}` },
  emailed: { icon: <Mail />, text: (e) => `Emailed to ${e.detail?.to ?? "the customer"}` },
  email_failed: { icon: <Mail />, text: () => "The email didn't go out" },
  viewed: { icon: <Eye />, text: () => "Opened by the customer" },
  payment: {
    icon: <Wallet />,
    text: (e) =>
      `$${viewDollars(String(e.detail?.amount ?? "0")).toFixed(2)} received${e.detail?.rail === "manual" ? " (by hand)" : " on NEAR"}`,
  },
  reminder: { icon: <Bell />, text: () => "Reminder sent" },
  marked_paid: {
    icon: <HandCoins />,
    text: (e) => `Marked paid by hand${e.detail?.note ? `: ${e.detail.note}` : ""}`,
  },
  paid: { icon: <Check />, text: () => "Paid in full" },
  voided: { icon: <Ban />, text: () => "Voided" },
}

function TimelineItem({ event, last }: { event: InvoiceEvent; last: boolean }) {
  const meta = EVENT[event.kind]
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last ? (
        <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-secondary" />
      ) : null}
      <span
        className={cn(
          "relative grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4",
          event.kind === "paid"
            ? "bg-up-surface text-up"
            : event.kind === "voided"
              ? "bg-down-surface text-down"
              : "bg-secondary text-foreground",
        )}
      >
        {meta.icon}
      </span>
      <span className="flex min-w-0 flex-col pt-1">
        <span className="text-[15px] font-medium">{meta.text(event)}</span>
        <span className="text-detail text-muted-foreground">
          {new Date(event.createdAt).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </span>
    </li>
  )
}
