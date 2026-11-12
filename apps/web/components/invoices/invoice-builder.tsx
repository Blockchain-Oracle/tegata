"use client"

// The invoice builder (plan 6.8 K; Acctual flow 8839, Mercury flow 11047): the form on the left, and on the right a
// live preview on the stage, either the paper invoice or the real pay page the customer will see, at phone size. On
// a phone the two switch with Edit / Preview. Totals are worked out with the same core maths the server uses, and
// the server works them out again before anything is sent.
import {
  addDays,
  daysBetween,
  invoiceTotals,
  parseDollars,
  parsePercent,
  parseQuantity,
} from "@tegata/core/invoices"
import type { InvoiceEmailData } from "@tegata/documents"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Segmented } from "@/components/kit/segmented"
import { Stage } from "@/components/kit/stage"
import { Switch } from "@/components/kit/switch"
import { PayView } from "@/components/pay/pay-view"

import type { Customer, DraftForm } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

import { CustomerPicker, type NewCustomer } from "./customer-picker"
import { InvoicePaper, type Party } from "./invoice-paper"

const TERMS = [
  { value: "0", label: "On receipt" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "date", label: "Date" },
]

export function emptyDraft(today: string): DraftForm {
  return {
    customerId: null,
    issueDate: today,
    dueDate: addDays(today, 14),
    notes: "",
    discount: null,
    taxRate: "",
    allowPartial: false,
    reminders: true,
    repeat: null,
    lines: [{ description: "", quantity: "1", unitPrice: "" }],
  }
}

export interface BuilderBusiness {
  from: Party
  logo: string | null
  payAddress: string
  sandbox: boolean
}

export interface BuilderProblem {
  field: string | null
  message: string
}

/** Live totals for the form, and which lines can't be read yet. */
export function draftTotals(form: DraftForm) {
  const lines = form.lines.map((line) => ({
    quantityMilli: parseQuantity(line.quantity || "1") ?? 0n,
    unitPrice: parseDollars(line.unitPrice || "0") ?? 0n,
  }))
  const discountValue = form.discount?.value.trim() ?? ""
  const discount =
    !form.discount || !discountValue
      ? null
      : form.discount.kind === "percent"
        ? { kind: "percent" as const, bp: parsePercent(discountValue) ?? 0 }
        : { kind: "fixed" as const, amount: parseDollars(discountValue) ?? 0n }
  const taxBp = form.taxRate.trim() ? (parsePercent(form.taxRate) ?? 0) : 0
  return { ...invoiceTotals(lines, discount, taxBp), taxBp }
}

export function InvoiceBuilder({
  title,
  initial,
  customers,
  business,
  onCreateCustomer,
  creatingCustomer,
  customerProblem,
  saving,
  problem,
  onSave,
  onSend,
}: {
  title: string
  initial: DraftForm
  customers: Customer[] | undefined
  business: BuilderBusiness
  onCreateCustomer: (input: NewCustomer, then: (customer: Customer) => void) => void
  creatingCustomer: boolean
  customerProblem: string | null
  saving: "draft" | "send" | null
  problem: BuilderProblem | null
  onSave: (form: DraftForm) => void
  onSend: (form: DraftForm) => void
}) {
  const [form, setForm] = useState(initial)
  const [preview, setPreview] = useState<"invoice" | "pay" | "email">("invoice")
  const [phoneView, setPhoneView] = useState<"edit" | "preview">("edit")
  const totals = useMemo(() => draftTotals(form), [form])
  const customer = customers?.find((c) => c.id === form.customerId) ?? null
  const terms = daysBetween(form.issueDate, form.dueDate)
  const termsValue = [0, 7, 14, 30].includes(terms) ? String(terms) : "date"
  const set = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const setLine = (i: number, key: "description" | "quantity" | "unitPrice", value: string) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [key]: value } : l)) }))
  const fieldProblem = (field: string) => (problem?.field === field ? problem.message : null)

  const discountLabel =
    form.discount?.kind === "percent" && form.discount.value
      ? `Discount ${form.discount.value}%`
      : "Discount"

  const paper = (
    <InvoicePaper
      from={business.from}
      logo={business.logo}
      to={
        customer
          ? {
              name: customer.name,
              email: customer.email,
              address: customer.address,
              taxId: customer.taxId,
            }
          : null
      }
      number={null}
      issueDate={form.issueDate}
      dueDate={form.dueDate}
      lines={form.lines
        .filter((l) => l.description.trim() || l.unitPrice.trim())
        .map((line, i) => ({
          description: line.description,
          quantity: line.quantity || "1",
          unitPrice: parseDollars(line.unitPrice || "0") ?? 0n,
          amount: totals.lines[form.lines.indexOf(line)] ?? totals.lines[i] ?? 0n,
        }))}
      subtotal={totals.subtotal}
      discount={totals.discount}
      discountLabel={discountLabel}
      tax={totals.tax}
      taxLabel={form.taxRate ? `Tax ${form.taxRate}%` : null}
      total={totals.total}
      notes={form.notes.trim() || null}
      payAddress={business.payAddress}
      sandbox={business.sandbox}
    />
  )

  const payPreview = (
    <div
      className="pointer-events-none mx-auto h-[640px] w-[390px] max-w-full overflow-hidden rounded-[28px] bg-background shadow-object"
      aria-hidden
    >
      <PayView
        request={{
          token: "preview",
          business: business.from.name,
          logo: business.logo,
          title: "Invoice",
          note: null,
          amount: totals.total.toString(),
          status: "open",
          network: business.sandbox ? "testnet" : "mainnet",
          receiverId: business.payAddress,
          usdc: "",
          invoice: {
            number: "INV-····",
            allowPartial: form.allowPartial,
            dueDate: form.dueDate,
            remaining: totals.total.toString(),
          },
        }}
        amount={viewDollars(totals.total).toFixed(2)}
        onAmount={() => undefined}
        rail="tegata"
        onRail={() => undefined}
        step="choose"
        tegata={{ kind: "signed_out" }}
        onSignIn={() => undefined}
        onFinishAccount={() => undefined}
        walletAccount={null}
        connecting={false}
        onConnect={() => undefined}
        onDisconnect={() => undefined}
        routes={[]}
        routeId=""
        onRoute={() => undefined}
        quote={{ loading: false }}
        busy={false}
        problem={null}
        onPayTegata={() => undefined}
        onPayWallet={() => undefined}
        usedRail={null}
        progress={0}
        startedAt={0}
        attempt={null}
        onTryAgain={() => undefined}
      />
    </div>
  )

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
        <h1 className="display flex-1 text-page-title">{title}</h1>
        <div className="flex gap-2 max-sm:w-full">
          <Button
            variant="secondary"
            size="md"
            className="max-sm:flex-1"
            busy={saving === "draft"}
            disabled={saving !== null}
            onClick={() => onSave(form)}
          >
            Save draft
          </Button>
          <Button
            size="md"
            className="max-sm:flex-1"
            busy={saving === "send"}
            disabled={saving !== null}
            cue="tap"
            onClick={() => onSend(form)}
          >
            Review and send
          </Button>
        </div>
      </header>

      <Segmented
        label="Edit or preview"
        className="lg:hidden"
        value={phoneView}
        onValueChange={(v) => setPhoneView(v as "edit" | "preview")}
        options={[
          { value: "edit", label: "Edit" },
          { value: "preview", label: "Preview" },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <form
          className={cn(
            "flex flex-col gap-6 rounded-[24px] bg-card p-5 sm:p-6",
            phoneView === "preview" && "max-lg:hidden",
          )}
          onSubmit={(e) => {
            e.preventDefault()
            onSend(form)
          }}
        >
          <CustomerPicker
            customers={customers}
            value={form.customerId}
            onChange={(id) => set("customerId", id)}
            onCreate={(input) =>
              onCreateCustomer(input, (created) => set("customerId", created.id))
            }
            creating={creatingCustomer}
            createProblem={customerProblem}
            invalid={fieldProblem("customer")}
          />

          <section className="@container flex flex-col gap-3">
            <span className="text-detail font-medium text-muted-foreground">Items</span>
            <div className="hidden grid-cols-[minmax(0,1fr)_72px_112px_96px_36px] gap-2 px-1 text-[12px] font-semibold text-text-3 @xl:grid">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {form.lines.map((line, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place; order is their identity.
                key={i}
                className="grid grid-cols-[72px_minmax(0,1fr)_36px] items-center gap-2 rounded-[16px] bg-secondary/60 p-2 @xl:grid-cols-[minmax(0,1fr)_72px_112px_96px_36px] @xl:rounded-none @xl:bg-transparent @xl:p-0"
              >
                <input
                  aria-label={`Item ${i + 1} description`}
                  placeholder="Logo design"
                  value={line.description}
                  maxLength={200}
                  onChange={(e) => setLine(i, "description", e.target.value)}
                  className="col-span-3 h-12 min-w-0 rounded-[12px] bg-input px-3 text-[16px] font-medium outline-none focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)] @xl:col-span-1"
                />
                <input
                  aria-label={`Item ${i + 1} quantity`}
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(e) => setLine(i, "quantity", e.target.value.replace(/[^0-9.]/g, ""))}
                  className="tnum h-12 min-w-0 rounded-[12px] bg-input px-3 text-right text-[16px] font-medium outline-none focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]"
                />
                <div className="flex h-12 min-w-0 items-center rounded-[12px] bg-input px-3 focus-within:bg-card focus-within:shadow-[0_0_0_2px_var(--shu)]">
                  <span className="text-[16px] text-text-3">$</span>
                  <input
                    aria-label={`Item ${i + 1} price`}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLine(i, "unitPrice", e.target.value.replace(/[^0-9.,]/g, ""))
                    }
                    className="tnum h-full min-w-0 flex-1 bg-transparent text-right text-[16px] font-medium outline-none"
                  />
                </div>
                <span className="tnum hidden truncate text-right text-[15px] font-semibold @xl:block">
                  ${viewDollars(totals.lines[i] ?? 0n).toFixed(2)}
                </span>
                <button
                  type="button"
                  aria-label={`Remove item ${i + 1}`}
                  disabled={form.lines.length === 1}
                  onClick={() => {
                    fire("tick")
                    setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))
                  }}
                  className="press grid size-9 place-items-center rounded-full text-text-3 hover:bg-secondary hover:text-down disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            {fieldProblem("lines") ? (
              <span className="text-detail font-medium text-down">{fieldProblem("lines")}</span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={form.lines.length >= 50}
              onClick={() => {
                fire("tick")
                setForm((f) => ({
                  ...f,
                  lines: [...f.lines, { description: "", quantity: "1", unitPrice: "" }],
                }))
              }}
            >
              <Plus /> Add item
            </Button>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-detail font-medium text-muted-foreground">Discount</span>
              <div className="flex gap-2">
                <Segmented
                  label="Discount kind"
                  value={form.discount?.kind ?? "percent"}
                  onValueChange={(kind) =>
                    set("discount", {
                      kind: kind as "percent" | "fixed",
                      value: form.discount?.value ?? "",
                    })
                  }
                  options={[
                    { value: "percent", label: "%" },
                    { value: "fixed", label: "$" },
                  ]}
                />
                <input
                  aria-label="Discount"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.discount?.value ?? ""}
                  onChange={(e) =>
                    set("discount", {
                      kind: form.discount?.kind ?? "percent",
                      value: e.target.value.replace(/[^0-9.]/g, ""),
                    })
                  }
                  className="tnum h-12 min-w-0 flex-1 rounded-[12px] bg-input px-3 text-right text-[16px] font-medium outline-none focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]"
                />
              </div>
              {fieldProblem("discount") ? (
                <span className="text-detail font-medium text-down">
                  {fieldProblem("discount")}
                </span>
              ) : null}
            </div>
            <Field
              id="tax-rate"
              label="Tax rate"
              inputMode="decimal"
              placeholder="0"
              value={form.taxRate}
              onChange={(e) => set("taxRate", e.target.value.replace(/[^0-9.]/g, ""))}
              trailing={<span className="text-[16px] text-text-3">%</span>}
              className="tnum"
              status={
                fieldProblem("tax")
                  ? { kind: "bad", text: fieldProblem("tax") ?? "" }
                  : { kind: "none" }
              }
            />
          </section>

          <section className="flex flex-col gap-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="issue-date"
                  className="text-detail font-medium text-muted-foreground"
                >
                  Issued
                </label>
                <input
                  id="issue-date"
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => {
                    const issueDate = e.target.value
                    if (!issueDate) return
                    setForm((f) => ({
                      ...f,
                      issueDate,
                      dueDate:
                        termsValue === "date" ? f.dueDate : addDays(issueDate, Math.max(0, terms)),
                    }))
                  }}
                  className="h-14 rounded-[14px] bg-input px-4 text-[16px] font-medium outline-none focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="due-date" className="text-detail font-medium text-muted-foreground">
                  Due
                </label>
                <input
                  id="due-date"
                  type="date"
                  min={form.issueDate}
                  value={form.dueDate}
                  onChange={(e) => e.target.value && set("dueDate", e.target.value)}
                  className="h-14 rounded-[14px] bg-input px-4 text-[16px] font-medium outline-none focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]"
                />
              </div>
            </div>
            <Segmented
              label="Payment terms"
              value={termsValue}
              onValueChange={(v) => {
                if (v !== "date") set("dueDate", addDays(form.issueDate, Number(v)))
              }}
              options={TERMS}
            />
            {fieldProblem("dates") ? (
              <span className="text-detail font-medium text-down">{fieldProblem("dates")}</span>
            ) : null}
          </section>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="invoice-notes"
              className="text-detail font-medium text-muted-foreground"
            >
              Notes (optional)
            </label>
            <textarea
              id="invoice-notes"
              rows={3}
              maxLength={1000}
              placeholder="Thanks for your business. Payment within 14 days, please."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="w-full resize-none rounded-[14px] bg-input px-4 py-3.5 text-[16px] font-medium outline-none placeholder:text-text-3 focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]"
            />
          </div>

          <section className="flex flex-col divide-y divide-secondary rounded-[16px] bg-secondary/60 px-4">
            <Toggle
              title="Allow part-payments"
              detail="The customer can pay some now, the rest later"
              checked={form.allowPartial}
              onChange={(v) => set("allowPartial", v)}
            />
            <Toggle
              title="Send reminders"
              detail="3 days before it's due, on the day, then 3 and 7 days late"
              checked={form.reminders}
              onChange={(v) => set("reminders", v)}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">Repeat</span>
                <span className="text-detail text-muted-foreground">
                  Send a fresh copy on a schedule
                </span>
              </span>
              <Segmented
                label="Repeat"
                value={form.repeat ?? "off"}
                onValueChange={(v) =>
                  set("repeat", v === "off" ? null : (v as "weekly" | "monthly"))
                }
                options={[
                  { value: "off", label: "Off" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
              />
            </div>
          </section>

          <div className="flex items-baseline justify-between border-t border-secondary pt-4">
            <span className="text-[15px] font-semibold">Total</span>
            <Figure value={viewDollars(totals.total)} className="text-[40px]" />
          </div>
          {problem &&
          !["customer", "lines", "discount", "tax", "dates"].includes(problem.field ?? "") ? (
            <p className="text-[15px] font-medium text-down">{problem.message}</p>
          ) : null}
        </form>

        <div
          className={cn(
            "flex flex-col gap-3 lg:sticky lg:top-6",
            phoneView === "edit" && "max-lg:hidden",
          )}
        >
          <Segmented
            label="Preview"
            value={preview}
            onValueChange={(v) => setPreview(v as "invoice" | "pay" | "email")}
            options={[
              { value: "invoice", label: "Invoice" },
              { value: "pay", label: "Pay page" },
              { value: "email", label: "Email" },
            ]}
          />
          <Stage className="p-3 sm:p-5" grid={false}>
            {preview === "invoice" ? (
              paper
            ) : preview === "pay" ? (
              payPreview
            ) : (
              <EmailPreview
                data={{
                  business: business.from.name,
                  customer: customer?.name ?? "there",
                  number: "INV-····",
                  total: totals.total.toString(),
                  remaining: totals.total.toString(),
                  dueDate: form.dueDate,
                  url: "#",
                  notes: form.notes.trim() || null,
                  sandbox: business.sandbox,
                }}
              />
            )}
          </Stage>
        </div>
      </div>
    </div>
  )
}

function Toggle({
  title,
  detail,
  checked,
  onChange,
}: {
  title: string
  detail: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-detail text-muted-foreground">{detail}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} label={title} />
    </div>
  )
}

const EMAIL_DEBOUNCE_MS = 250

/** The real email template, rendered in the browser on demand (the templates load only when this tab opens). */
function EmailPreview({ data }: { data: InvoiceEmailData }) {
  const [html, setHtml] = useState<string | null>(null)
  const key = JSON.stringify(data)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the data, serialised.
  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      void import("@tegata/documents/preview")
        .then(({ invoiceEmailHtml }) => invoiceEmailHtml(data))
        .then((out) => {
          if (live) setHtml(out)
        })
    }, EMAIL_DEBOUNCE_MS)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [key])
  return (
    <div className="overflow-hidden rounded-[20px] bg-white shadow-object">
      <div className="flex flex-col gap-0.5 border-b border-[#ECECEC] px-5 py-3 text-[13px] text-[#444]">
        <span>
          <span className="text-[#999]">From</span> {data.business} via Tegata
        </span>
        <span>
          <span className="text-[#999]">Subject</span> {data.number} from {data.business}
        </span>
      </div>
      {html ? (
        <iframe
          title="Email preview"
          srcDoc={html}
          sandbox=""
          className="h-[560px] w-full bg-[#F5F5F5]"
        />
      ) : (
        <div
          className="h-[560px] animate-skeleton bg-[#F5F5F5]"
          role="status"
          aria-label="Rendering the email"
        />
      )}
    </div>
  )
}
