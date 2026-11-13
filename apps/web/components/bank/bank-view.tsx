"use client"

// Bank: withdraw dollars to a bank account in naira, cedi or rand, and euro bank details whose
// deposits arrive as dollars. Noah is the licensed partner that pays the bank; the money leaves NEAR as USDC. Separate
// from its logic so /dev/flows can show every state.
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Share2,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { type ReactNode, useState } from "react"

import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Segmented } from "@/components/kit/segmented"
import { Paper, Stage } from "@/components/kit/stage"
import { ErrorState, StatusPill, TextShimmer } from "@/components/kit/states"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark } from "@/components/marks/mark"
import { Sheet } from "@/components/shell/sheet"
import { fire } from "@/lib/feedback"
import { FIAT_NAME, fiatMoney, groupNumber, lastFour, titleCase } from "@/lib/fiat"
import { cn } from "@/lib/utils"

import { BankDisc, CopyLine, Flag } from "./parts"
import { type NewRecipient, RecipientSheet } from "./recipient-sheet"

export type BankStep = "form" | "review" | "sending" | "paid" | "failed"
export type BankTab = "withdraw" | "receive"

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
  holder?: string | null
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

export interface SavedRecipient {
  id: string
  country: string
  fiat: string
  label: string
  holder: string | null
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

export type { NewRecipient }

export interface BankViewProps {
  available: boolean
  businessName: string
  balance: number
  tab: BankTab
  onTab: (tab: BankTab) => void
  countries: readonly { code: string; fiat: string; name: string }[]
  country: string
  onCountry: (code: string) => void
  amount: string
  onAmount: (value: string) => void
  saved: SavedRecipient[]
  /** A recipient filled in just now, saved with the first withdrawal. */
  fresh: NewRecipient | null
  onFresh: (recipient: NewRecipient) => void
  /** A saved recipient, or null for the fresh one. */
  accountId: string | null
  onAccount: (id: string | null) => void
  schema: FormSchema | null | undefined
  checkHolder: (form: Record<string, unknown>) => Promise<string | null>
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

const bankOf = (label: string) => label.replace(/\s*••\s*\d*$/, "")
const arrives = (seconds: number) =>
  seconds < 90 ? "about a minute" : `about ${Math.round(seconds / 60)} minutes`
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})
/** "13 Nov, 13:18": one fixed format, so the server and the browser draw the same text. */
const when = (iso: string) => DATE.format(new Date(iso))

/** A recipient as a row: their bank's disc, who holds it, the bank and the last four digits. */
function RecipientRow({
  label,
  holder,
  selected,
  onClick,
  tag,
}: {
  label: string
  holder: string | null
  selected: boolean
  onClick: () => void
  tag?: string
}) {
  const bank = titleCase(bankOf(label))
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "press flex items-center gap-3 rounded-[16px] bg-card px-3 py-3 text-left shadow-[0_0_0_1px_var(--border)]",
        selected && "shadow-[0_0_0_2px_var(--shu)]",
      )}
    >
      <BankDisc name={bank} size={40} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[16px] font-semibold">{holder ?? bank}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {holder ? `${bank} · ` : ""}
          <span className="font-mono">•• {lastFour(label)}</span>
        </span>
      </span>
      {tag ? (
        <span className="rounded-full bg-shu-wash px-2.5 py-1 text-[12px] font-semibold text-shu-ink">
          {tag}
        </span>
      ) : null}
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border-2",
          selected ? "border-shu bg-shu text-white" : "border-border",
        )}
      >
        {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
    </button>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-[15px]">
      <span className="text-[#6E6E6E]">{label}</span>
      <span className="text-right font-semibold text-black">{children}</span>
    </div>
  )
}

export function BankView(p: BankViewProps) {
  const reduce = useReducedMotion()
  const [picking, setPicking] = useState(false)
  const [adding, setAdding] = useState(false)
  const value = Number.parseFloat(p.amount || "0") || 0
  const over = value > p.balance
  const country = p.countries.find((c) => c.code === p.country) ?? p.countries[0]
  const savedHere = p.saved.filter((a) => a.country === p.country)
  const q = p.quote.data
  const low = q && value > 0 && value < Number(q.min)
  const chosen = p.accountId
    ? savedHere.find((a) => a.id === p.accountId)
    : p.fresh
      ? { label: p.fresh.label, holder: p.fresh.holder }
      : null
  const ready = value > 0 && !over && !low && Boolean(q) && Boolean(chosen)
  const slide = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as const },
  }
  const toName = p.payout?.holder ?? chosen?.holder ?? null
  const toLabel = p.payout?.account || chosen?.label || ""
  const toBank = titleCase(bankOf(toLabel))
  const steps = [
    { id: "sign", label: "Approved", detail: "with your key, on this device", icon: <KeyRound /> },
    {
      id: "near",
      label: "Left your balance",
      detail: "on NEAR, fee paid by Tegata",
      mark: "near" as const,
    },
    {
      id: "hop",
      label: "On its way to Noah",
      detail: p.available ? "as USDC on Solana" : "through NEAR Intents",
      icon: <Mark id="sol" size={20} />,
    },
    {
      id: "bank",
      label: `Paid to ${toName ?? toBank}`,
      detail: `${toBank} •• ${lastFour(toLabel)}`,
      icon: <BankDisc name={toBank || "Bank"} size={20} />,
    },
  ]

  if (!country) return null
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
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
        {p.available ? (
          <span className="ml-auto rounded-full border border-dashed border-border px-3 py-1 text-[13px] font-medium text-muted-foreground">
            Sandbox · Noah's test bank
          </span>
        ) : null}
      </div>

      {!p.available ? (
        <div className="flex items-center gap-3 rounded-[16px] bg-kin px-4 py-3 text-black">
          <Lock className="size-5 shrink-0" />
          <p className="text-[15px] font-medium">
            Live bank payouts open after Noah's business review. Try it in the Sandbox.
          </p>
        </div>
      ) : null}

      {p.step === "form" ? (
        <Segmented
          label="Bank"
          value={p.tab}
          onValueChange={(v) => p.onTab(v as BankTab)}
          options={[
            { value: "withdraw", label: "Withdraw" },
            { value: "receive", label: "Receive" },
          ]}
        />
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {p.step === "form" && p.tab === "withdraw" ? (
          <motion.form
            key="withdraw"
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (ready && p.available) p.onReview()
            }}
            {...slide}
          >
            {/* The converter: what leaves your balance, what reaches their bank. */}
            <Stage className="p-3 sm:p-6">
              <Paper className="overflow-hidden">
                <div className="flex flex-col gap-1 px-5 pt-5 pb-4">
                  <label htmlFor="bank-amount" className="text-[14px] font-medium text-[#6E6E6E]">
                    You send
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="flex min-w-0 flex-1 items-baseline">
                      <span
                        className={cn(
                          "figure text-[48px] leading-none",
                          value > 0 ? "text-black" : "text-[#B8B8B8]",
                        )}
                      >
                        $
                      </span>
                      <input
                        id="bank-amount"
                        inputMode="decimal"
                        placeholder="0"
                        autoComplete="off"
                        value={p.amount}
                        onChange={(e) =>
                          p.onAmount(
                            e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"),
                          )
                        }
                        className="figure w-full min-w-0 bg-transparent text-[48px] leading-none text-black caret-shu outline-none placeholder:text-[#B8B8B8]"
                      />
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#F1F1F1] py-1.5 pr-3.5 pl-1.5 text-[15px] font-semibold text-black">
                      <Mark id="usdc" size={26} /> USDC
                    </span>
                  </div>
                  <span className="text-[13px] text-[#6E6E6E]">
                    {over ? (
                      <span className="font-semibold text-[#C8283F]">
                        More than your ${p.balance.toFixed(2)}
                      </span>
                    ) : (
                      <>
                        Balance ${p.balance.toFixed(2)} ·{" "}
                        <button
                          type="button"
                          onClick={() => p.onAmount(p.balance.toFixed(2))}
                          className="font-semibold text-[#B23700] hover:underline"
                        >
                          Use all
                        </button>
                      </>
                    )}
                  </span>
                </div>

                <ul className="relative mx-5 flex flex-col gap-2 border-l-2 border-dotted border-[#D9D9D9] py-1 pl-5 text-[14px] text-[#444]">
                  {q ? (
                    <>
                      <li className="tnum">
                        1 USD = <span className="font-semibold">{fiatMoney(q.fiat, q.rate)}</span>
                      </li>
                      <li className="tnum">
                        Noah's fee{" "}
                        <span className="font-semibold">
                          {value > 0 ? fiatMoney(q.fiat, q.fee) : "—"}
                        </span>
                      </li>
                      <li className={cn(low && "font-semibold text-[#8A5800]")}>
                        {low
                          ? `At least $${Number(q.min).toFixed(2)} to this bank`
                          : `Arrives in ${arrives(q.seconds)}`}
                      </li>
                    </>
                  ) : p.quote.error ? (
                    <li className="font-semibold text-[#8A5800]">{p.quote.error}</li>
                  ) : (
                    <li>
                      <TextShimmer className="text-[14px]">Getting Noah's rate…</TextShimmer>
                    </li>
                  )}
                </ul>

                <div className="mt-4 flex flex-col gap-1 bg-[#F6F6F6] px-5 pt-4 pb-5">
                  <span className="text-[14px] font-medium text-[#6E6E6E]">They get</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "figure min-w-0 flex-1 truncate text-[48px] leading-none tnum",
                        q && value > 0 ? "text-black" : "text-[#B8B8B8]",
                      )}
                      aria-live="polite"
                    >
                      {q && value > 0
                        ? fiatMoney(q.fiat, q.fiatAmount)
                        : fiatMoney(country.fiat, 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPicking(true)}
                      className="press inline-flex shrink-0 items-center gap-2 rounded-full bg-white py-1.5 pr-2.5 pl-1.5 text-[15px] font-semibold text-black shadow-[0_0_0_1px_#E2E2E2]"
                      aria-label={`Currency: ${FIAT_NAME[country.fiat] ?? country.fiat}. Change country`}
                    >
                      <Flag code={country.code} size={26} />
                      {country.fiat}
                      <ChevronDown className="size-4 text-[#6E6E6E]" />
                    </button>
                  </div>
                </div>
              </Paper>
            </Stage>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold">To</h2>
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="press inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[14px] font-semibold"
                >
                  <Plus className="size-4" /> New recipient
                </button>
              </div>
              {p.fresh ? (
                <RecipientRow
                  label={p.fresh.label}
                  holder={p.fresh.holder}
                  selected={p.accountId === null}
                  onClick={() => p.onAccount(null)}
                  tag="New"
                />
              ) : null}
              {savedHere.map((a) => (
                <RecipientRow
                  key={a.id}
                  label={a.label}
                  holder={a.holder}
                  selected={p.accountId === a.id}
                  onClick={() => p.onAccount(a.id)}
                />
              ))}
              {!p.fresh && savedHere.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="press flex items-center gap-3 rounded-[16px] border-2 border-dashed border-border px-3 py-3 text-left"
                >
                  <Flag code={country.code} size={40} />
                  <span className="flex-1 text-[15px] font-semibold">
                    Add a bank account in {country.name}
                  </span>
                  <Plus className="size-5 text-muted-foreground" />
                </button>
              ) : null}
            </section>

            {p.problem ? <p className="text-[15px] font-medium text-down">{p.problem}</p> : null}
            {p.holder ? (
              <div className="flex flex-col gap-3 rounded-[20px] bg-card p-4 shadow-[0_0_0_2px_var(--shu)]">
                <span className="flex items-center gap-3">
                  <BankDisc name={toBank} size={40} />
                  <span className="flex flex-col">
                    <span className="text-[13px] text-muted-foreground">The bank says it's</span>
                    <span className="text-[17px] font-bold uppercase">{p.holder}</span>
                  </span>
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" type="button" onClick={p.onRejectHolder}>
                    Not them
                  </Button>
                  <Button type="button" busy={p.busy} onClick={p.onConfirmHolder}>
                    Pay them
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="submit" busy={p.busy} disabled={!ready || !p.available}>
                {!chosen && value > 0 ? "Choose who to pay" : "Continue"}
              </Button>
            )}

            {p.recent.length ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-[17px] font-semibold">Recent</h2>
                <ul className="flex flex-col divide-y divide-border rounded-[16px] bg-card px-3">
                  {p.recent.map((r) => {
                    const bank = titleCase(bankOf(r.account))
                    return (
                      <li key={r.id} className="flex items-center gap-3 py-3">
                        <BankDisc name={bank} size={36} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[15px] font-semibold">
                            {r.holder ?? bank}
                          </span>
                          <span className="truncate text-[13px] text-muted-foreground">
                            {when(r.createdAt)} · ${viewDollars(r.amount).toFixed(2)}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <span className="tnum text-[15px] font-semibold">
                            {fiatMoney(r.fiat, r.fiatAmount)}
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
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}
          </motion.form>
        ) : p.step === "form" && p.tab === "receive" ? (
          <motion.div key="receive" className="flex flex-col gap-5" {...slide}>
            <Receive {...p} />
          </motion.div>
        ) : p.step === "review" && p.payout ? (
          <motion.div key="review" className="flex flex-col gap-5" {...slide}>
            <Stage className="p-3 sm:p-6">
              <Paper className="flex flex-col gap-4 p-5">
                <span className="flex flex-col gap-1">
                  <span className="text-[14px] font-medium text-[#6E6E6E]">You withdraw</span>
                  <Figure value={viewDollars(p.payout.amount)} className="text-[56px] text-black" />
                </span>
                <div className="flex items-center gap-3 rounded-[16px] bg-[#F6F6F6] p-3">
                  <BankDisc name={toBank} size={44} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[17px] font-semibold text-black">
                      {toName ?? toBank}
                    </span>
                    <span className="truncate text-[13px] text-[#6E6E6E]">
                      {toBank} · <span className="font-mono">•• {lastFour(toLabel)}</span>
                    </span>
                  </span>
                  <Flag code={p.payout.fiat} size={24} className="ml-auto" />
                </div>
                <div className="flex flex-col divide-y divide-[#ECECEC] rounded-[16px] bg-[#F6F6F6] px-4">
                  <Row label="They get">
                    <span className="tnum text-[17px]">
                      {fiatMoney(p.payout.fiat, p.payout.fiatAmount)}
                    </span>
                  </Row>
                  <Row label="Rate">
                    <span className="tnum">1 USD = {fiatMoney(p.payout.fiat, p.payout.rate)}</span>
                  </Row>
                  <Row label="Noah's fee">
                    <span className="tnum">{fiatMoney(p.payout.fiat, p.payout.fee)}</span>
                  </Row>
                  <Row label="Network fee">
                    <span className="inline-flex items-center gap-1.5">
                      <TegataSeal size={18} textured={false} /> Paid by Tegata
                    </span>
                  </Row>
                  <Row label="Arrives">{q ? `In ${arrives(q.seconds)}` : "In minutes"}</Row>
                </div>
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
            <Stage className="px-5 py-8" inner="flex flex-col items-center gap-2 text-center">
              <span className="flex items-center gap-2 text-[15px] font-medium text-white/90">
                <Flag code={p.payout?.fiat ?? country.fiat} size={22} />
                To {toName ?? toBank}
              </span>
              <span className="figure tnum text-[52px] leading-none text-white">
                {p.payout ? fiatMoney(p.payout.fiat, p.payout.fiatAmount) : "—"}
              </span>
              <span className="rounded-full bg-white/18 px-3 py-1 text-[14px] text-white">
                ${(value || viewDollars(p.payout?.amount ?? "0")).toFixed(2)} from your balance
              </span>
            </Stage>
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
              <div className="flex flex-col gap-1 p-6 pb-4">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-[#6E6E6E]">
                  <TegataSeal size={20} textured={false} /> Paid to a bank
                </span>
                <span className="figure tnum mt-2 text-[52px] leading-none">
                  {fiatMoney(p.payout.fiat, p.payout.fiatAmount)}
                </span>
                <span className="text-[14px] text-[#6E6E6E]">
                  ${viewDollars(p.payout.amount).toFixed(2)} from {p.businessName}
                </span>
              </div>
              <div className="relative h-4">
                <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-background" />
                <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-background" />
                <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-[#E2E2E2]" />
              </div>
              <div className="flex flex-col gap-3 p-6 pt-3">
                <span className="flex items-center gap-3">
                  <BankDisc name={toBank} size={40} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[16px] font-semibold">{toName ?? toBank}</span>
                    <span className="truncate text-[13px] text-[#6E6E6E]">
                      {toBank} · <span className="font-mono">•• {lastFour(toLabel)}</span>
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
                  {p.payout.nearTx ? (
                    <a
                      href={`https://testnet.nearblocks.io/txns/${p.payout.nearTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[#B23700] hover:underline"
                    >
                      <Mark id="near" size={16} /> On NEAR <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                  {p.payout.hopTx ? (
                    <a
                      href={`https://explorer.solana.com/tx/${p.payout.hopTx}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[#B23700] hover:underline"
                    >
                      <Mark id="sol" size={16} /> To Noah <ExternalLink className="size-3.5" />
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

      <Sheet open={picking} onOpenChange={setPicking} title="Send to">
        <ul className="flex flex-col gap-2">
          {p.countries.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => {
                  p.onCountry(c.code)
                  setPicking(false)
                  fire("tick", { cue: "step" })
                }}
                aria-pressed={c.code === p.country}
                className={cn(
                  "press flex w-full items-center gap-3 rounded-[16px] bg-secondary px-3 py-3 text-left",
                  c.code === p.country && "bg-card shadow-[0_0_0_2px_var(--shu)]",
                )}
              >
                <Flag code={c.code} size={36} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[16px] font-semibold">{c.name}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {FIAT_NAME[c.fiat] ?? c.fiat} · {c.fiat}
                  </span>
                </span>
                {c.code === p.country ? <Check className="size-5 text-shu" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <RecipientSheet
        open={adding}
        onOpenChange={setAdding}
        country={country}
        schema={p.schema}
        sandbox={p.available}
        checkHolder={p.checkHolder}
        onDone={(r) => {
          p.onFresh(r)
          setAdding(false)
        }}
      />
    </div>
  )
}

/** Receive by bank transfer: the euro account card on the stage, a test transfer in the Sandbox, and what arrived. */
function Receive(p: BankViewProps) {
  const [test, setTest] = useState("5")
  const [shared, setShared] = useState(false)
  const d = p.details
  const all = d
    ? [
        `Account holder: ${d.holder}`,
        `${d.rail === "BankSepa" ? "IBAN" : "Account number"}: ${d.number}`,
        d.code ? `BIC: ${d.code}` : null,
        `Bank: ${titleCase(d.bank)}`,
      ]
        .filter(Boolean)
        .join("\n")
    : ""
  return (
    <>
      <Stage className="p-3 sm:p-6">
        <Paper className="flex flex-col p-5">
          <div className="flex items-center gap-3 pb-2">
            <Flag code={d?.fiat ?? "EUR"} size={40} />
            <span className="flex flex-col">
              <span className="text-[17px] font-bold text-black">
                {FIAT_NAME[d?.fiat ?? "EUR"] ?? "Euro"} account
              </span>
              <span className="text-[13px] text-[#6E6E6E]">
                {d?.rail === "BankSepa" || !d ? "IBAN · SEPA transfers" : d.rail}
              </span>
            </span>
            {d ? (
              <span className="ml-auto rounded-full bg-[#E9F7D4] px-2.5 py-1 text-[12px] font-semibold text-[#2F7A00]">
                Active
              </span>
            ) : null}
          </div>
          {d ? (
            <>
              <div className="flex flex-col divide-y divide-[#ECECEC]">
                <CopyLine label="Account holder" value={d.holder} mono={false} />
                <CopyLine
                  label={d.rail === "BankSepa" ? "IBAN" : "Account number"}
                  value={d.number}
                  shown={groupNumber(d.number)}
                />
                {d.code ? <CopyLine label="BIC" value={d.code} /> : null}
                <CopyLine label="Bank" value={titleCase(d.bank)} mono={false} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  className="bg-[#F1F1F1] text-black hover:bg-[#E6E6E6]"
                  onClick={async () => {
                    await navigator.clipboard.writeText(all)
                    fire("tick", { cue: "confirmed" })
                    setShared(true)
                    setTimeout(() => setShared(false), 1400)
                  }}
                >
                  {shared ? <Check /> : null} {shared ? "Copied" : "Copy all"}
                </Button>
                <Button
                  className="bg-black text-white hover:bg-black/85"
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: `${p.businessName} bank details`,
                          text: all,
                        })
                      } catch {
                        // Closed without sharing.
                      }
                    } else {
                      await navigator.clipboard.writeText(all)
                      fire("tick", { cue: "confirmed" })
                    }
                  }}
                >
                  <Share2 /> Share
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 pt-2">
              {["Account holder", "IBAN", "BIC"].map((label) => (
                <span key={label} className="flex flex-col gap-1.5 border-t border-[#ECECEC] pt-3">
                  <span className="text-[13px] font-medium text-[#6E6E6E]">{label}</span>
                  <span className="h-4 w-3/5 rounded-full bg-[#F1F1F1]" />
                </span>
              ))}
              <Button
                className="mt-2 bg-black text-white hover:bg-black/85"
                busy={p.gettingDetails}
                disabled={!p.available}
                onClick={p.onGetDetails}
              >
                Get euro bank details
              </Button>
            </div>
          )}
        </Paper>
      </Stage>

      <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
        <Mark id="usdc" size={20} /> Euro transfers arrive as dollars in your balance.
      </p>

      <div className="flex items-center gap-3 rounded-[16px] bg-card px-3 py-3 opacity-80 shadow-[0_0_0_1px_var(--border)]">
        <Flag code="USD" size={36} />
        <span className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold">US dollar account</span>
          <span className="text-[13px] text-muted-foreground">ACH and wire</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[12px] font-semibold">
          <Lock className="size-3" /> Live
        </span>
      </div>

      {d && p.available ? (
        <div className="flex flex-col gap-3 rounded-[20px] bg-sora p-4 text-black">
          <span className="text-[15px] font-semibold">Send a test transfer</span>
          <div className="flex flex-wrap items-center gap-2">
            {["2", "5", "10"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTest(v)}
                aria-pressed={test === v}
                className={cn(
                  "press rounded-full px-4 py-2 text-[15px] font-semibold",
                  test === v ? "bg-black text-white" : "bg-white/70",
                )}
              >
                {fiatMoney(d.fiat, v).replace(/\.00$/, "")}
              </button>
            ))}
            <Button
              size="sm"
              className="ml-auto bg-black text-white hover:bg-black/85"
              busy={p.simulating}
              onClick={() => p.onSimulate(test)}
            >
              {p.simulated ? <Check /> : null} {p.simulated ? "Sent" : "Send"}
            </Button>
          </div>
        </div>
      ) : null}

      {p.deposits.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[17px] font-semibold">Arrived</h2>
          <ul className="flex flex-col divide-y divide-border rounded-[16px] bg-card px-3">
            {p.deposits.map((dep) => (
              <li key={dep.id} className="flex items-center gap-3 py-3">
                <Flag code={dep.fiat} size={36} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold">
                    {fiatMoney(dep.fiat, dep.fiatAmount)}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {when(dep.createdAt)}
                    {dep.error ? ` · ${dep.error}` : ""}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="inline-flex items-center gap-1.5 tnum text-[15px] font-semibold text-up">
                    <Mark id="usdc" size={16} />
                    +${viewDollars(dep.amount).toFixed(2)}
                  </span>
                  <StatusPill
                    tone={
                      dep.status === "credited" ? "up" : dep.status === "failed" ? "down" : "wait"
                    }
                  >
                    {dep.status === "credited"
                      ? "In your balance"
                      : dep.status === "failed"
                        ? "Not credited"
                        : "Arriving"}
                  </StatusPill>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
