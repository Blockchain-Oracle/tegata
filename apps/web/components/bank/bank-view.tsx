"use client"

// Bank (plan 6.8 AC): withdraw dollars to a bank account (Nigeria in naira first), and bank details whose deposits
// arrive as dollars in the balance. Noah is the licensed partner that pays the bank; the money leaves NEAR as USDC.
// Separate from its logic so /dev/flows can show every state.
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  KeyRound,
  Landmark,
  Plus,
  RefreshCw,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { type ReactNode, useState } from "react"

import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Segmented } from "@/components/kit/segmented"
import { Paper, Stage } from "@/components/kit/stage"
import { ErrorState, StatusPill, TextShimmer } from "@/components/kit/states"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

export type BankStep = "form" | "review" | "sending" | "paid" | "failed"

export interface BankQuoteView {
  channelId: string
  fiat: string
  rate: string
  fiatAmount: string
  fee: string
  min: string
  max: string
  seconds: number
}

export interface BankPayoutView {
  id: string
  status: "drafted" | "sending" | "converting" | "paying" | "paid" | "failed"
  amount: string
  fiat: string
  fiatAmount: string
  rate: string
  fee: string
  account: string
  nearTx: string | null
  hopTx: string | null
  error: string | null
  paidAt: string | null
  createdAt: string
}

export interface BankDetailsView {
  fiat: string
  holder: string
  number: string
  bank: string
  code: string | null
  rail: string
}

export interface BankDepositView {
  id: string
  fiat: string
  fiatAmount: string
  amount: string
  status: string
  creditTx: string | null
  error: string | null
  createdAt: string
}

/** A JSON Schema as Noah sends a bank's form: objects, strings, enums. */
export interface FormSchema {
  type?: string
  title?: string
  enum?: string[]
  properties?: Record<string, FormSchema>
  required?: string[]
  minLength?: number
  maxLength?: number
}

export interface BankViewProps {
  available: boolean
  businessName: string
  balance: number
  countries: readonly { code: string; fiat: string; name: string }[]
  country: string
  onCountry: (code: string) => void
  amount: string
  onAmount: (value: string) => void
  saved: { id: string; country: string; fiat: string; label: string }[]
  /** A saved account, or null for a new one. */
  accountId: string | null
  onAccount: (id: string | null) => void
  schema: FormSchema | null | undefined
  form: Record<string, unknown>
  onForm: (form: Record<string, unknown>) => void
  quote: { data?: BankQuoteView; error?: string | null; loading: boolean }
  step: BankStep
  payout: BankPayoutView | null
  progress: number
  busy: boolean
  problem: string | null
  onReview: () => void
  /** The account holder Noah's bank check found, waiting for the business to confirm. */
  holder?: string | null
  onConfirmHolder?: () => void
  onRejectHolder?: () => void
  onApprove: () => void
  onEdit: () => void
  onAgain: () => void
  details: BankDetailsView | null
  deposits: BankDepositView[]
  onGetDetails: () => void
  gettingDetails: boolean
  onSimulate: (amount: string) => void
  simulating: boolean
  simulated: boolean
  recent: BankPayoutView[]
}

const FLAG: Record<string, string> = { NG: "🇳🇬", GH: "🇬🇭", ZA: "🇿🇦" }
const money = (fiat: string, amount: string) =>
  `${Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${fiat}`

/** Whether a filled form has everything Noah's schema requires. */
export function formComplete(
  schema: FormSchema | null | undefined,
  form: Record<string, unknown>,
): boolean {
  if (!schema?.properties) return false
  return (schema.required ?? []).every((key) => {
    const field = schema.properties?.[key]
    const value = form[key]
    if (field?.type === "object")
      return formComplete(field, (value as Record<string, unknown>) ?? {})
    return typeof value === "string" && value.trim().length >= (field?.minLength ?? 1)
  })
}

/** Renders Noah's form for a bank: a searchable list for an enum, a field for text, nested groups flattened. */
function SchemaForm({
  schema,
  value,
  onChange,
  prefix = "",
}: {
  schema: FormSchema
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  prefix?: string
}) {
  return (
    <>
      {Object.entries(schema.properties ?? {}).map(([key, field]) => {
        const id = `bank-${prefix}${key}`
        const required = schema.required?.includes(key)
        if (field.type === "object")
          return (
            <SchemaForm
              key={key}
              schema={field}
              prefix={`${prefix}${key}-`}
              value={(value[key] as Record<string, unknown>) ?? {}}
              onChange={(next) => onChange({ ...value, [key]: next })}
            />
          )
        const label = `${field.title ?? key}${required ? "" : " (optional)"}`
        if (field.enum)
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-detail font-medium text-muted-foreground">
                {label}
              </label>
              <input
                id={id}
                list={`${id}-list`}
                value={(value[key] as string) ?? ""}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                placeholder="Start typing to search"
                className="h-14 w-full rounded-[14px] bg-input px-4 text-[17px] font-medium outline-none focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]"
              />
              <datalist id={`${id}-list`}>
                {field.enum.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          )
        return (
          <Field
            key={key}
            id={id}
            label={label}
            value={(value[key] as string) ?? ""}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            maxLength={field.maxLength}
            inputMode={/account/i.test(key) ? "numeric" : undefined}
            className={/account/i.test(key) ? "font-mono" : undefined}
          />
        )
      })}
    </>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        fire("tick", { cue: "confirmed" })
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
      className="press flex w-full items-center gap-3 rounded-[14px] bg-secondary px-4 py-3 text-left"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-detail text-muted-foreground">{label}</span>
        <span className="break-all font-mono text-[15px] font-medium">{value}</span>
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card [&_svg]:size-4">
        {copied ? <Check /> : <Copy />}
      </span>
    </button>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[#666]">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  )
}

export function BankView(p: BankViewProps) {
  const reduce = useReducedMotion()
  const value = Number.parseFloat(p.amount || "0") || 0
  const over = value > p.balance
  const country = p.countries.find((c) => c.code === p.country) ?? p.countries[0]
  const savedHere = p.saved.filter((a) => a.country === p.country)
  const ready =
    value > 0 &&
    !over &&
    Boolean(p.quote.data) &&
    (p.accountId !== null || formComplete(p.schema, p.form))
  const slide = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as const },
  }
  const account =
    p.payout?.account || savedHere.find((a) => a.id === p.accountId)?.label || "your bank account"
  const steps = [
    {
      id: "sign",
      label: "Approved with your key",
      detail: "signed on this device",
      icon: <KeyRound />,
    },
    {
      id: "near",
      label: "Sent from your balance",
      detail: "on NEAR · fee paid by Tegata",
      mark: "near" as const,
    },
    {
      id: "hop",
      label: "On its way to Noah",
      detail: "as USDC on Solana (Sandbox: Tegata's test wallet)",
      icon: <Mark id="sol" size={20} />,
    },
    {
      id: "bank",
      label: `Paid to ${account}`,
      detail: "by Noah, a licensed partner",
      icon: <Landmark />,
    },
  ]

  if (!country) return null
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
      <div className="flex items-center gap-3">
        {p.step === "review" ? (
          <button
            type="button"
            onClick={p.onEdit}
            className="press grid size-10 place-items-center rounded-full bg-secondary hover:bg-plate-pressed"
            aria-label="Change"
          >
            <ArrowLeft className="size-4" />
          </button>
        ) : null}
        <h1 className="display text-page-title">Bank</h1>
      </div>

      {!p.available ? (
        <div className="flex items-start gap-3 rounded-[20px] bg-kin/70 p-5 text-black">
          <Landmark className="mt-0.5 size-6 shrink-0" />
          <p className="text-[15px] font-medium">
            Bank payouts in Live open once Noah's business review is done. Switch to the Sandbox to
            withdraw to a test bank account and get bank details now: the same screens, on Noah's
            test bank network.
          </p>
        </div>
      ) : (
        <p className="text-detail text-muted-foreground">
          Sandbox: Noah's test bank network; no real money moves. The hop to Noah runs through
          Tegata's test wallet on Solana, where Live uses NEAR Intents.
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {p.step === "form" ? (
          <motion.form
            key="form"
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (ready && p.available) p.onReview()
            }}
            {...slide}
          >
            <Stage className="px-5 py-9">
              <div className="flex flex-col items-center gap-2">
                <label htmlFor="bank-amount" className="text-[15px] font-medium text-white/85">
                  Withdraw
                </label>
                <div className="flex items-baseline justify-center">
                  <span
                    className={cn("figure text-[56px]", value > 0 ? "text-white" : "text-white/55")}
                  >
                    $
                  </span>
                  <input
                    id="bank-amount"
                    inputMode="decimal"
                    placeholder="0"
                    value={p.amount}
                    onChange={(e) =>
                      p.onAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
                    }
                    size={Math.max(1, p.amount.length || 1)}
                    className="figure min-w-[1ch] bg-transparent text-center text-[80px] text-white caret-white outline-none placeholder:text-white/55 focus-visible:outline-none"
                  />
                </div>
                <span className="rounded-full bg-white/18 px-3 py-1 text-[14px] text-white">
                  {over ? "More than your " : "You have "}${p.balance.toFixed(2)}
                </span>
              </div>
            </Stage>

            <Segmented
              label="Country"
              value={p.country}
              onValueChange={p.onCountry}
              options={p.countries.map((c) => ({
                value: c.code,
                label: `${FLAG[c.code] ?? ""} ${c.name}`,
              }))}
            />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[15px] font-semibold">Pay to</legend>
              {savedHere.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => p.onAccount(a.id)}
                  aria-pressed={p.accountId === a.id}
                  className={cn(
                    "press flex items-center gap-3 rounded-[14px] bg-secondary px-4 py-3 text-left",
                    p.accountId === a.id && "bg-card shadow-[0_0_0_2px_var(--shu)]",
                  )}
                >
                  <Landmark className="size-5 shrink-0" />
                  <span className="flex-1 text-[15px] font-semibold">{a.label}</span>
                  <span className="text-detail text-muted-foreground">{a.fiat}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => p.onAccount(null)}
                aria-pressed={p.accountId === null}
                className={cn(
                  "press flex items-center gap-3 rounded-[14px] bg-secondary px-4 py-3 text-left",
                  p.accountId === null && "bg-card shadow-[0_0_0_2px_var(--shu)]",
                )}
              >
                <Plus className="size-5 shrink-0" />
                <span className="flex-1 text-[15px] font-semibold">
                  A new bank account in {country.name}
                </span>
              </button>
            </fieldset>

            {p.accountId === null ? (
              p.schema ? (
                <div className="flex flex-col gap-3 rounded-[20px] bg-card p-4 shadow-[0_0_0_1px_var(--border)]">
                  {p.available && p.country === "NG" ? (
                    <button
                      type="button"
                      onClick={() =>
                        p.onForm({
                          BankDetails: { Bank: "Access Bank", AccountNumber: "0690000031" },
                          PaymentPurpose: "Salary payment",
                        })
                      }
                      className="press self-start rounded-full bg-secondary px-3 py-1.5 text-[13px] font-semibold"
                    >
                      Use Noah's test account (Access Bank 0690000031)
                    </button>
                  ) : null}
                  <SchemaForm schema={p.schema} value={p.form} onChange={p.onForm} />
                  <p className="text-detail text-muted-foreground">
                    The bank's own form, from Noah. Saved for next time.
                  </p>
                </div>
              ) : p.schema === null ? null : (
                <TextShimmer className="text-[15px]">{`Asking Noah for ${country.name}'s bank form…`}</TextShimmer>
              )
            ) : null}

            <div className="flex flex-col gap-1 rounded-[14px] bg-secondary px-4 py-3">
              <span className="flex items-center justify-between text-detail text-muted-foreground">
                <span>They get</span>
                <span className="inline-flex items-center gap-1.5">
                  <Landmark className="size-3.5" /> Live rate from Noah
                </span>
              </span>
              {value <= 0 ? (
                <span className="text-[17px] font-semibold text-text-3">Enter an amount</span>
              ) : p.quote.data ? (
                <>
                  <span className="flex items-center justify-between gap-3">
                    <span className="tnum text-[20px] font-semibold">
                      {money(p.quote.data.fiat, p.quote.data.fiatAmount)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-detail text-muted-foreground">
                      <Clock3 className="size-3.5" /> about{" "}
                      {Math.max(1, Math.round(p.quote.data.seconds / 60))} min
                    </span>
                  </span>
                  <span className="text-detail text-muted-foreground">
                    {Number(p.quote.data.rate).toLocaleString("en-US")} {p.quote.data.fiat} per
                    dollar · Noah's fee {money(p.quote.data.fiat, p.quote.data.fee)} · at least $
                    {Number(p.quote.data.min).toFixed(2)}
                  </span>
                </>
              ) : p.quote.error ? (
                <span className="text-[15px] font-medium text-warn">{p.quote.error}</span>
              ) : (
                <TextShimmer className="text-[17px]">Asking Noah…</TextShimmer>
              )}
            </div>
            {p.problem ? <p className="text-[15px] font-medium text-down">{p.problem}</p> : null}
            {p.holder ? (
              <div className="flex flex-col gap-3 rounded-[20px] bg-card p-5 shadow-[0_0_0_2px_var(--shu)]">
                <span className="text-detail font-medium text-muted-foreground">
                  Noah checked the account with the bank
                </span>
                <span className="text-[17px]">
                  It belongs to <span className="font-semibold">{p.holder}</span>. Is that who
                  you're paying?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" type="button" onClick={p.onRejectHolder}>
                    No, change it
                  </Button>
                  <Button type="button" busy={p.busy} onClick={p.onConfirmHolder}>
                    Yes, continue
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="submit" busy={p.busy} disabled={!ready || !p.available}>
                {value > 0 ? `Review $${value.toFixed(2)}` : "Enter an amount"}
              </Button>
            )}
          </motion.form>
        ) : p.step === "review" && p.payout ? (
          <motion.div key="review" className="flex flex-col gap-5" {...slide}>
            <Stage className="p-4 sm:p-6">
              <Paper className="flex flex-col gap-1 p-6">
                <span className="text-detail font-medium text-[#666]">You withdraw</span>
                <Figure value={viewDollars(p.payout.amount)} className="text-[64px]" />
                <div className="mt-4 flex flex-col divide-y divide-[#ECECEC] text-[15px]">
                  <Row label="To">{p.payout.account || account}</Row>
                  <Row label="They get">{money(p.payout.fiat, p.payout.fiatAmount)}</Row>
                  <Row label="Rate">
                    {Number(p.payout.rate).toLocaleString("en-US")} {p.payout.fiat} per dollar
                  </Row>
                  <Row label="Network fee">
                    <span className="inline-flex items-center gap-1.5">
                      <TegataSeal size={18} textured={false} /> Paid by Tegata
                    </span>
                  </Row>
                </div>
                <p className="mt-3 flex items-start gap-2 text-[13px] text-[#666]">
                  <Landmark className="mt-0.5 size-4 shrink-0" />
                  Paid out by Noah, a licensed partner. If the bank can't be paid, the dollars come
                  back to your balance.
                </p>
              </Paper>
            </Stage>
            {p.problem ? <p className="text-[15px] font-medium text-down">{p.problem}</p> : null}
            <HoldButton
              label={`Hold to withdraw $${viewDollars(p.payout.amount).toFixed(2)}`}
              busy={p.busy}
              onConfirm={p.onApprove}
            />
          </motion.div>
        ) : p.step === "sending" ? (
          <motion.div key="sending" className="flex flex-col gap-5" {...slide}>
            <div className="flex flex-col items-center gap-1 rounded-[24px] bg-card p-6 text-center">
              <span className="text-detail font-medium text-muted-foreground">
                Withdrawing to {account}
              </span>
              <Figure
                value={value || viewDollars(p.payout?.amount ?? "0")}
                className="text-[56px]"
              />
            </div>
            <div className="rounded-[20px] bg-secondary p-2">
              <TaskSteps steps={steps} current={p.progress} />
            </div>
            {p.payout?.error && p.payout.status === "converting" ? (
              <p className="flex items-start gap-2 rounded-[14px] bg-warn-surface px-4 py-3 text-[14px] font-medium text-warn">
                <RefreshCw className="mt-0.5 size-4 shrink-0" /> {p.payout.error}. Tegata retries
                every minute.
              </p>
            ) : null}
          </motion.div>
        ) : p.step === "paid" && p.payout ? (
          <motion.div key="paid" className="flex flex-col gap-5" {...slide}>
            <div className="relative rounded-[20px] bg-white text-black shadow-receipt">
              <div className="p-6 pb-4">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-[#666]">
                  <TegataSeal size={20} textured={false} /> Receipt · Paid to a bank
                </span>
                <Figure value={viewDollars(p.payout.amount)} className="mt-3 flex text-[56px]" />
                <div className="mt-2 flex items-center gap-2 text-[15px] font-semibold">
                  <Landmark className="size-5" /> {p.payout.account}
                </div>
              </div>
              <div className="relative h-4">
                <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-background" />
                <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-background" />
                <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-[#E2E2E2]" />
              </div>
              <div className="flex flex-col gap-2.5 p-6 pt-3 text-[14px]">
                <Row label="They received">{money(p.payout.fiat, p.payout.fiatAmount)}</Row>
                <Row label="Paid out by">Noah</Row>
                <Row label="From">{p.businessName}</Row>
                <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {p.payout.nearTx ? (
                    <a
                      href={`https://testnet.nearblocks.io/txns/${p.payout.nearTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[#B23700] hover:underline"
                    >
                      On NEAR <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                  {p.payout.hopTx ? (
                    <a
                      href={`https://explorer.solana.com/tx/${p.payout.hopTx}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[#B23700] hover:underline"
                    >
                      To Noah, on Solana <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <SealPress
                  delay={0.2}
                  onLanded={() => fire("filled", { cue: "sent", identity: p.payout?.id })}
                >
                  <BusinessSeal name={p.businessName} band="Paid" size={96} />
                </SealPress>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={p.onAgain}>
                Withdraw again
              </Button>
              <Button asChild>
                <Link href="/app/activity">Activity</Link>
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="failed" className="flex flex-col gap-5" {...slide}>
            <ErrorState
              title="That withdrawal didn't go through"
              detail={p.problem ?? p.payout?.error ?? "Noah couldn't pay the bank account."}
              stillWorks={
                p.payout?.nearTx
                  ? "The dollars come back to your balance."
                  : "No money left your balance."
              }
              onRetry={p.onEdit}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <section className="flex flex-col gap-4 rounded-[24px] bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Landmark className="size-5" />
          <h2 className="text-[17px] font-semibold">Your bank details</h2>
        </div>
        {p.details ? (
          <>
            <p className="text-[15px] text-muted-foreground">
              Customers can pay you by bank transfer. What arrives turns into dollars in your
              balance on NEAR.
            </p>
            <div className="flex flex-col gap-2">
              <CopyRow label="Account holder" value={p.details.holder} />
              <CopyRow
                label={p.details.rail === "BankSepa" ? "IBAN (SEPA, euros)" : "Account number"}
                value={p.details.number}
              />
              {p.details.code ? <CopyRow label="BIC / bank code" value={p.details.code} /> : null}
              <CopyRow label="Bank" value={p.details.bank} />
            </div>
            {p.available ? (
              <SimulateDeposit
                fiat={p.details.fiat}
                onSimulate={p.onSimulate}
                busy={p.simulating}
                done={p.simulated}
              />
            ) : null}
            {p.deposits.length ? (
              <ul className="flex flex-col divide-y divide-secondary rounded-[16px] bg-secondary/60 px-4">
                {p.deposits.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex flex-col">
                      <span className="text-[14px] font-semibold">
                        {money(d.fiat, d.fiatAmount)} → ${viewDollars(d.amount).toFixed(2)}
                      </span>
                      <span className="text-detail text-muted-foreground">
                        {new Date(d.createdAt).toLocaleString(undefined, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {d.error ? ` · ${d.error}` : ""}
                      </span>
                    </span>
                    <StatusPill
                      tone={
                        d.status === "credited" ? "up" : d.status === "failed" ? "down" : "wait"
                      }
                    >
                      {d.status === "credited"
                        ? "In your balance"
                        : d.status === "failed"
                          ? "Not credited"
                          : "Arriving"}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-[15px] text-muted-foreground">
              Get an account number customers can pay by bank transfer. Deposits turn into dollars
              in your balance.
              {p.available ? " In the Sandbox it's a euro IBAN on Noah's test network." : ""}
            </p>
            <Button
              variant="secondary"
              busy={p.gettingDetails}
              disabled={!p.available}
              onClick={p.onGetDetails}
            >
              <Landmark /> Get bank details
            </Button>
          </>
        )}
      </section>

      {p.recent.length ? (
        <section className="flex flex-col gap-2">
          <span className="text-detail font-medium text-muted-foreground">Withdrawals</span>
          <ul className="flex flex-col divide-y divide-secondary rounded-[16px] bg-card px-4">
            {p.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-semibold">{r.account}</span>
                  <span className="text-detail text-muted-foreground">
                    ${viewDollars(r.amount).toFixed(2)} → {money(r.fiat, r.fiatAmount)}
                  </span>
                </span>
                <StatusPill
                  tone={
                    r.status === "paid"
                      ? "up"
                      : r.status === "failed"
                        ? "down"
                        : r.status === "drafted"
                          ? "quiet"
                          : "wait"
                  }
                >
                  {r.status === "paid"
                    ? "Paid"
                    : r.status === "failed"
                      ? "Returned"
                      : r.status === "drafted"
                        ? "Not approved"
                        : "On its way"}
                </StatusPill>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function SimulateDeposit({
  fiat,
  onSimulate,
  busy,
  done,
}: {
  fiat: string
  onSimulate: (amount: string) => void
  busy: boolean
  done: boolean
}) {
  const [amount, setAmount] = useState("5")
  return (
    <div className="flex flex-col gap-2 rounded-[16px] bg-secondary/60 p-4">
      <span className="text-[15px] font-semibold">Try it: simulate a bank transfer</span>
      <span className="text-detail text-muted-foreground">
        Noah's sandbox sends a test transfer to this account; it arrives in your balance in about a
        minute.
      </span>
      <div className="flex gap-2">
        <Field
          id="simulate-amount"
          label={`Amount (${fiat}, 1 to 20)`}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        />
        <Button className="self-end" busy={busy} onClick={() => onSimulate(amount)}>
          {done ? <Check /> : null} {done ? "Sent" : "Simulate"}
        </Button>
      </div>
    </div>
  )
}
