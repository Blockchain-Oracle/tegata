"use client"

// One invoice: the number in display type, the document on the stage, stamped
// when paid; beside it, on its own stage, what is received and left with the actions as an icon row; then the
// payments (each with the real mark of how it was paid, opening its receipt) and the timeline of everything that
// happened. Separate from its logic so /dev/flows can show every state.
import { quantityText } from "@tegata/core/invoices"
import {
  ArrowLeft,
  Ban,
  Bell,
  Check,
  ChevronRight,
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
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { CustomerDisc } from "@/components/invoices/customer-picker"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Stage } from "@/components/kit/stage"
import { ErrorState, Skeleton } from "@/components/kit/states"
import { Switch } from "@/components/kit/switch"
import { PayerName, railWord } from "@/components/links/link-detail-view"
import { PaidWithMark } from "@/components/marks/paid-with"
import { Sheet } from "@/components/shell/sheet"
import type { InvoiceDetail, InvoiceEvent, LinkPayment, ReminderState } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { usd, usdUnits } from "@/lib/fiat"
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
  busy: "void" | "paid" | "duplicate" | "remind" | "reminders" | null
  problem: string | null
  /** Set just after "Remind now" was accepted: who it's going to. */
  remindedTo?: string | null
  onVoid: () => void
  onMarkPaid: (amount: string, note: string) => void
  onDuplicate: () => void
  onRemind?: () => void
  onReminders?: (on: boolean) => void
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
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
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
        <h1 className="display text-page-title">{label}</h1>
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
          <span className="flex min-w-0 items-center gap-3 text-[15px] font-semibold text-shu-ink">
            <Send className="size-5 shrink-0" />
            <span className="truncate">
              {label} sent{inv.billTo?.name ? ` to ${inv.billTo.name}` : ""}
            </span>
          </span>
          <Button size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
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
          <Stage className="p-5 sm:p-6" grid={false} tone={inv.status === "paid" ? "paid" : "shu"}>
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[14px] font-medium text-white/85">Received</span>
                <Figure value={viewDollars(paid)} className="text-[44px] text-white" />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[14px] font-medium text-white/85">
                  {inv.status === "void" ? "Cancelled" : "Left to pay"}
                </span>
                <Figure value={viewDollars(d.remaining)} className="text-[24px] text-white" />
              </div>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-white/25"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Paid so far"
            >
              <div
                className="h-full rounded-full bg-white transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="mt-2 block text-[14px] text-white/85">
              of {usdUnits(total)}
              {inv.allowPartial ? " · part-payments on" : ""}
            </span>
            <div className="mt-6 grid grid-cols-3 gap-x-2 gap-y-4">
              <Action
                icon={copied ? <Check /> : <Copy />}
                label={copied ? "Copied" : "Copy link"}
                onClick={copy}
                disabled={!p.url}
              />
              <Action icon={<Share2 />} label="Share" onClick={share} disabled={!p.url} />
              <Action
                icon={<ExternalLink />}
                label="Open"
                href={p.url ?? undefined}
                disabled={!p.url}
              />
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
                    label="Paid by hand"
                    onClick={() => {
                      setAmount(viewDollars(d.remaining).toFixed(2))
                      setNote("")
                      setSheet("paid")
                    }}
                  />
                  <Action icon={<Ban />} label="Void" onClick={() => setSheet("void")} />
                </>
              ) : null}
            </div>
          </Stage>

          {d.customer ? (
            <Link
              href={`/app/customers?id=${d.customer.id}`}
              className="press flex items-center gap-3 rounded-[16px] bg-card px-4 py-3 hover:bg-secondary"
            >
              <CustomerDisc name={d.customer.name} size={36} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-detail text-muted-foreground">Billed to</span>
                <span className="truncate text-[15px] font-semibold">{d.customer.name}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-text-3" />
            </Link>
          ) : null}
          {d.reminders ? (
            <RemindersRow
              r={d.reminders}
              busy={p.busy}
              remindedTo={p.remindedTo ?? null}
              onRemind={p.onRemind}
              onToggle={p.onReminders}
            />
          ) : null}
          {p.problem ? <p className="text-[15px] font-medium text-down">{p.problem}</p> : null}

          {d.payments.some((pay) => pay.status === "succeeded") ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-section-title font-semibold">Payments</h2>
              <div className="flex flex-col rounded-[20px] bg-card p-2">
                {d.payments
                  .filter((pay) => pay.status === "succeeded")
                  .map((pay) =>
                    // A payment opens its receipt; one without a receipt yet is a plain row, never a dead link.
                    pay.receiptToken ? (
                      <Link
                        key={pay.id}
                        href={`/r/${pay.receiptToken}`}
                        className="press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
                      >
                        <PaymentLine pay={pay} />
                        <ReceiptText className="size-4 shrink-0 text-text-3" />
                      </Link>
                    ) : (
                      <div
                        key={pay.id}
                        className="flex items-center gap-3 rounded-[14px] px-3 py-3"
                      >
                        <PaymentLine pay={pay} />
                      </div>
                    ),
                  )}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <h2 className="text-section-title font-semibold">Timeline</h2>
            <ol className="flex flex-col rounded-[20px] bg-card p-4">
              {[...d.events].reverse().map((event, i, all) => (
                <TimelineItem
                  key={event.id}
                  event={event}
                  last={i === all.length - 1}
                  payment={d.payments.find((pay) => pay.id === event.detail?.paymentId)}
                />
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
          <Field
            id="paid-amount"
            label="Received outside Tegata"
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
            Record {usd(Number(amount || 0))}
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
            Stops its link{inv.scheduleId ? " and its repeat" : ""}. Can't be undone.
          </p>
          {paid > 0n ? (
            <div className="flex items-center justify-between gap-3 rounded-[14px] bg-secondary px-4 py-3 text-[15px]">
              <span className="text-muted-foreground">Already received, stays yours</span>
              <span className="tnum font-semibold">{usdUnits(paid)}</span>
            </div>
          ) : null}
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

/**
 * Reminders after sending: the next one in the business's time zone, a switch for the scheduled ones and
 * "Remind now" (once a day). A customer without an email, or a server without email, says so instead.
 */
function RemindersRow({
  r,
  busy,
  remindedTo,
  onRemind,
  onToggle,
}: {
  r: ReminderState
  busy: InvoiceDetailViewProps["busy"]
  remindedTo: string | null
  onRemind?: () => void
  onToggle?: (on: boolean) => void
}) {
  const line = remindedTo
    ? `On its way to ${remindedTo}`
    : !r.canSend
      ? r.why
      : !r.on
        ? "Off"
        : r.next
          ? `Next: ${r.next.label}`
          : "All sent"
  const reminded = r.remindedToday || Boolean(remindedTo)
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-card px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary [&_svg]:size-4">
        <Bell />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-detail text-muted-foreground">Reminders</span>
        <span className="truncate text-[15px] font-semibold">{line}</span>
      </span>
      {r.canSend ? (
        <>
          <button
            type="button"
            onClick={onRemind}
            disabled={reminded || busy === "remind"}
            className="press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 text-[13px] font-semibold disabled:opacity-50"
          >
            {busy === "remind" ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : reminded ? (
              <Check className="size-3.5" />
            ) : null}
            {reminded ? "Reminded today" : "Remind now"}
          </button>
          <Switch
            checked={r.on}
            onCheckedChange={(on) => onToggle?.(on)}
            disabled={busy === "reminders"}
            label="Scheduled reminders"
          />
        </>
      ) : null}
    </div>
  )
}

/** An action on the stage: a white circle and its label (the icon row, like Home's stage actions). */
function Action({
  icon,
  label,
  onClick,
  href,
  disabled,
  busy,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  busy?: boolean
}) {
  const cls =
    "group press flex flex-col items-center gap-2 text-center disabled:opacity-50 aria-disabled:opacity-50"
  const circle = (
    <>
      <span className="grid size-12 place-items-center rounded-full bg-white text-black shadow-object transition-transform group-active:scale-95 [&_svg]:size-5">
        {busy ? (
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          icon
        )}
      </span>
      <span className="text-[13px] leading-tight font-semibold text-white">{label}</span>
    </>
  )
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {circle}
      </a>
    )
  return (
    <button
      type="button"
      className={cls}
      onClick={() => {
        fire("tick")
        onClick?.()
      }}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {circle}
    </button>
  )
}

/** A payment to this invoice: how it was paid (its real mark), who paid, when, and the amount. */
function PaymentLine({ pay }: { pay: LinkPayment }) {
  return (
    <>
      <PaidWithMark rail={pay.rail} assetIn={pay.assetIn} size={36} />
      <span className="flex min-w-0 flex-1 flex-col">
        <PayerName payer={pay.payer} email={pay.payerEmail} rail={pay.rail} />
        <span className="truncate text-detail text-muted-foreground">
          {railWord(pay.rail, pay.assetIn)} ·{" "}
          {new Date(pay.settledAt ?? pay.createdAt).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </span>
      <span className="tnum text-[15px] font-semibold text-up">+{usdUnits(pay.amount)}</span>
    </>
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
    // Drawn with the payment's own mark in TimelineItem; this is the fallback.
    icon: <HandCoins />,
    text: (e) =>
      `${usdUnits(String(e.detail?.amount ?? "0"))} received${e.detail?.rail === "manual" ? " by hand" : " on NEAR"}`,
  },
  reminder: {
    icon: <Bell />,
    text: (e) => {
      const offset = Number(e.detail?.offset ?? 0)
      if (e.detail?.source === "manual") return "Reminder sent by you"
      if (offset < 0) return `Reminder sent, ${-offset} days before it was due`
      if (offset === 0) return "Reminder sent on the due date"
      return offset >= 7 ? "Final reminder sent" : `Reminder sent, ${offset} days late`
    },
  },
  marked_paid: {
    icon: <HandCoins />,
    text: (e) => `Marked paid by hand${e.detail?.note ? `: ${e.detail.note}` : ""}`,
  },
  paid: { icon: <Check />, text: () => "Paid in full" },
  voided: { icon: <Ban />, text: () => "Voided" },
}

function TimelineItem({
  event,
  last,
  payment,
}: {
  event: InvoiceEvent
  last: boolean
  /** For a payment event: the payment, so it shows how it was paid. */
  payment?: LinkPayment
}) {
  const meta = EVENT[event.kind]
  const rail = (payment?.rail ?? event.detail?.rail ?? null) as LinkPayment["rail"] | null
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last ? (
        <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-secondary" />
      ) : null}
      {event.kind === "payment" && rail ? (
        <span className="relative grid size-8 shrink-0 place-items-center">
          <PaidWithMark rail={rail} assetIn={payment?.assetIn} size={32} />
        </span>
      ) : (
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
      )}
      <span className="flex min-w-0 flex-col pt-1">
        <span className="text-[15px] font-medium [overflow-wrap:anywhere]">{meta.text(event)}</span>
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
