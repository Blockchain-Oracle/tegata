"use client"

// The pay page (D′ and AD job 2), phone first: the business and the amount on the stage, then the ways to
// pay as large rows with real marks (a bank card through Transak, a Tegata balance, a NEAR wallet, another chain through
// NEAR Intents), then live steps and a sealed slip once NEAR has settled it. No app chrome: the business's seal at the top, NEAR at the foot.
// Separate from its logic so /dev/flows can show every state.
import {
  Check,
  ChevronDown,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  IdCard,
  KeyRound,
  Lock,
  Plus,
  ReceiptText,
  Wallet,
  X,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useState } from "react"
import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { SandboxPill } from "@/components/kit/sandbox-pill"
import { Paper, Stage } from "@/components/kit/stage"
import { ErrorState, Skeleton, TextShimmer, WaitingText } from "@/components/kit/states"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark, MarkStack } from "@/components/marks/mark"
import { CardNetworksMark, PaidWithMark, paidVia } from "@/components/marks/paid-with"
import { DepositPanel } from "@/components/pay/deposit-panel"
import { ReceiptSlip, SlipRow } from "@/components/receipt/receipt-slip"
import type { TestDollars } from "@/hooks/use-test-dollars"
import type { AttemptView, PaymentRail, PublicRequest } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { coinAmount, usd, usdUnits } from "@/lib/fiat"
import { eta } from "@/lib/routes"
import { cn } from "@/lib/utils"

export type PayStep = "choose" | "paying" | "paid" | "failed"

export type TegataState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "no_account" }
  | { kind: "own_link"; accountId: string }
  | { kind: "ready"; accountId: string; balance: number }

export interface PayRoute {
  id: string
  symbol: string
  chain: string
  coin: string
  chainMark: string
}

export interface RouteQuote {
  amountInFormatted: string
  timeEstimate: number
}

export interface PayViewProps {
  request: PublicRequest
  /** Dollars typed by the payer, for an any-amount link. */
  amount: string
  onAmount: (value: string) => void
  rail: PaymentRail | null
  onRail: (rail: PaymentRail | null) => void
  step: PayStep
  tegata: TegataState
  onSignIn: () => void
  onFinishAccount: () => void
  walletAccount: string | null
  connecting: boolean
  onConnect: () => void
  onDisconnect: () => void
  routes: readonly PayRoute[]
  routeId: string
  onRoute: (id: string) => void
  quote: { data?: RouteQuote; loading: boolean; error?: string }
  busy: boolean
  problem: string | null
  onPayTegata: () => void
  onPayWallet: () => void
  /** Live: the payer's address on their chain, for a refund; then a deposit address from NEAR Intents. */
  refundTo: string
  onRefundTo: (value: string) => void
  /** Optional: where a wallet or other-chain payer wants their receipt (a Tegata payer gets it at their sign-in). */
  receiptEmail?: string
  onReceiptEmail?: (value: string) => void
  onPayChain: () => void
  /** Which rail the payment in flight uses. */
  usedRail: PaymentRail | null
  /** Index of the active step (TaskSteps). */
  progress: number
  startedAt: number
  attempt: AttemptView | null
  onTryAgain: () => void
  /** Sandbox only: today's test dollars, offered when the balance is short. */
  testDollars?: TestDollars
  onAddTestDollars?: () => void
  /** Paying by card (Transak): whether cards are open here, and what the card pays, fee included. */
  card?: {
    open: boolean
    reason?: string
    quote?: { fiat: string; total: number; fee: number } | null
    loading: boolean
  }
  onPayCard?: () => void
  /** Transak's checkout, while it's open in the page. */
  cardUrl?: string | null
  onCloseCard?: () => void
}

/** Card payments, after the checkout: Tegata's own steps. */
const CARD_STEPS = [
  { id: "charged", label: "Card charged", icon: <CreditCard /> },
  { id: "usdc", label: "Sending as USDC on NEAR", mark: "usdc" as const },
  { id: "paid", label: "Checked on NEAR", mark: "near" as const },
]

const TEGATA_STEPS = [
  {
    id: "sign",
    label: "Approved with your key",
    icon: <KeyRound />,
  },
  {
    id: "relay",
    label: "Sent by Tegata · no fee to you",
    icon: <TegataSeal size={18} textured={false} tilt={0} />,
  },
  {
    id: "near",
    label: "Checked on NEAR",
    mark: "near" as const,
  },
]

const WALLET_STEPS = [
  {
    id: "wallet",
    label: "Sent from your wallet",
    mark: "usdc" as const,
  },
  {
    id: "near",
    label: "Checked on NEAR",
    mark: "near" as const,
  },
  { id: "receipt", label: "Receipt issued", icon: <ReceiptText /> },
]

/** Buttons on white paper, which stays light in both themes: ink, or a sunk plate. */
const ON_PAPER = {
  primary: "bg-black text-white hover:bg-black/85",
  secondary: "bg-paper-sunk text-black hover:bg-paper-rule",
} as const

export function PayView(p: PayViewProps) {
  const reduce = useReducedMotion()
  const invoice = p.request.invoice
  const open = p.request.status === "open"
  // A paid or cancelled invoice shows what it was for, not the $0.00 left on it.
  const closedInvoice = invoice !== null && !open
  const fixed = invoice ? !invoice.allowPartial || closedInvoice : p.request.amount !== null
  const dollars = closedInvoice
    ? viewDollars(p.request.amount ?? "0")
    : invoice && fixed
      ? viewDollars(invoice.remaining)
      : fixed
        ? viewDollars(p.request.amount!)
        : Number.parseFloat(p.amount || "0") || 0
  const closed = invoice
    ? p.request.status === "paid"
      ? {
          title: `Invoice ${invoice.number} is paid`,
          detail: "Nothing is left to pay. Its receipts are on the invoice.",
        }
      : {
          title: "This invoice was cancelled",
          detail: `Ask ${p.request.business} if you still owe them.`,
        }
    : p.request.receiptToken
      ? {
          title: "Paid",
          detail: `${p.request.business} has received this payment. Your receipt is ready.`,
        }
      : {
          title:
            p.request.status === "paid"
              ? "This link has been paid"
              : "This link isn't taking payments",
          detail: `Ask ${p.request.business} for a new link if you still owe them.`,
        }
  const sandbox = p.request.network === "testnet"
  const chains = new Set(p.routes.map((r) => r.chain)).size
  const slide = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as const },
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 pt-4 pb-10 sm:pt-10">
        <Stage className="px-5 pt-5 pb-7 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow-object">
              {p.request.logo ? (
                <img src={p.request.logo} alt="" className="size-full object-cover" />
              ) : (
                <BusinessSeal name={p.request.business} size={50} tilt={-4} />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[14px] font-medium text-white/85">Pay</span>
              <span className="truncate text-[20px] font-semibold text-white">
                {p.request.business}
              </span>
            </span>
            {sandbox ? (
              <SandboxPill tone="stage" className="ml-auto shrink-0">
                Sandbox
              </SandboxPill>
            ) : null}
          </div>
          <div className="mt-7 flex flex-col items-center gap-1.5 text-center">
            <span className="text-[16px] font-medium text-white/90">
              {invoice ? `Invoice ${invoice.number}` : p.request.title}
            </span>
            {fixed || p.step !== "choose" ? (
              <Figure value={dollars} className="text-[64px] text-white sm:text-[76px]" />
            ) : (
              <label className="flex items-baseline justify-center">
                <span className="sr-only">Amount in dollars</span>
                <span
                  className={cn("figure text-[56px]", dollars > 0 ? "text-white" : "text-white/55")}
                >
                  $
                </span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={p.amount}
                  onChange={(e) =>
                    p.onAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
                  }
                  size={Math.max(1, p.amount.length || 1)}
                  className="figure min-w-[1ch] bg-transparent text-center text-[76px] text-white caret-white outline-none placeholder:text-white/55 focus-visible:outline-none"
                />
              </label>
            )}
            {invoice ? (
              <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[14px] text-white/85">
                <span>
                  Due{" "}
                  {new Date(`${invoice.dueDate}T12:00:00Z`).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {invoice.allowPartial && open && p.step === "choose" ? (
                  <span>· up to {usdUnits(invoice.remaining)}</span>
                ) : null}
                <Link
                  href={`/i/${p.request.token}`}
                  className="font-semibold text-white underline-offset-2 hover:underline"
                >
                  View invoice
                </Link>
              </span>
            ) : p.request.note ? (
              <p className="max-w-sm text-[14px] text-white/85">{p.request.note}</p>
            ) : null}
            <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/18 py-1 pr-3 pl-1.5 text-[13px] font-medium text-white">
              <Mark id="usdc" chain="near" size={20} />
              {p.request.business} receives exactly this in USDC
            </span>
          </div>
        </Stage>

        <AnimatePresence mode="wait" initial={false}>
          {!open && p.step === "choose" ? (
            <motion.div key="closed" {...slide}>
              <Stage className="p-3 sm:p-4" grid={false}>
                <Paper className="flex flex-col items-center gap-3 p-8 text-center">
                  {p.request.receiptToken ? (
                    <BusinessSeal name={p.request.business} band="Paid" size={96} />
                  ) : (
                    <span className="grid size-14 place-items-center rounded-full bg-paper-sunk">
                      <Lock className="size-6" />
                    </span>
                  )}
                  <span className="text-[18px] font-semibold">{closed.title}</span>
                  <span className="text-[15px] text-paper-text-2">{closed.detail}</span>
                  {invoice ? (
                    <Button asChild variant="secondary" className={cn("mt-2", ON_PAPER.secondary)}>
                      <Link href={`/i/${p.request.token}`}>
                        <ReceiptText /> View invoice
                      </Link>
                    </Button>
                  ) : null}
                  {p.request.receiptToken ? (
                    <div className="mt-2 grid w-full grid-cols-1 gap-2">
                      {p.request.successUrl ? (
                        <Button asChild className={ON_PAPER.primary}>
                          <a href={p.request.successUrl}>Back to {p.request.business}</a>
                        </Button>
                      ) : null}
                      <Button
                        variant={p.request.successUrl ? "secondary" : "primary"}
                        className={p.request.successUrl ? ON_PAPER.secondary : ON_PAPER.primary}
                        asChild
                      >
                        <Link href={`/r/${p.request.receiptToken}`}>
                          <ReceiptText /> View your receipt
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </Paper>
              </Stage>
            </motion.div>
          ) : p.step === "choose" ? (
            <motion.section key="choose" className="flex flex-col gap-3" {...slide}>
              <h2 className="px-1 text-section-title font-semibold">How do you want to pay?</h2>
              {p.card ? (
                <RailRow
                  selected={p.rail === "card"}
                  onSelect={() => p.onRail(p.rail === "card" ? null : "card")}
                  art={<CardNetworksMark size={48} />}
                  title="Card"
                  detail={
                    p.card.open
                      ? "Visa, Mastercard · about 2 minutes"
                      : (p.card.reason ?? "Opening soon")
                  }
                >
                  <CardPayPanel {...p} dollars={dollars} />
                </RailRow>
              ) : null}
              <RailRow
                selected={p.rail === "tegata"}
                onSelect={() => p.onRail(p.rail === "tegata" ? null : "tegata")}
                art={
                  <span className="grid size-12 place-items-center rounded-full bg-white shadow-object">
                    <TegataSeal size={30} textured={false} tilt={0} />
                  </span>
                }
                title="Tegata balance"
                detail="Sign in with email · no fees"
                badge={sandbox ? "Easiest" : undefined}
              >
                <TegataPanel {...p} dollars={dollars} />
              </RailRow>
              <RailRow
                selected={p.rail === "near_wallet"}
                onSelect={() => p.onRail(p.rail === "near_wallet" ? null : "near_wallet")}
                art={<Mark id="near" size={48} />}
                title="NEAR wallet"
                // NEAR Connect lists the wallets that support the network: HOT and MyNearWallet are mainnet-only.
                detail={sandbox ? "Meteor, Intear and more" : "HOT, Meteor, MyNearWallet, Intear"}
              >
                <WalletPanel {...p} dollars={dollars} />
              </RailRow>
              <RailRow
                selected={p.rail === "oneclick"}
                onSelect={() => p.onRail(p.rail === "oneclick" ? null : "oneclick")}
                art={<MarkStack ids={["usdt", "usdc", "btc", "eth", "sol"]} size={24} />}
                title="Another chain"
                detail={chains > 0 ? `${chains} chains` : "Any chain"}
              >
                <ChainPanel {...p} dollars={dollars} />
              </RailRow>
            </motion.section>
          ) : p.step === "paying" && p.usedRail === "card" && p.cardUrl ? (
            <motion.div key="card-checkout" className="flex flex-col gap-3" {...slide}>
              <div className="flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <CardNetworksMark size={28} /> Pay by card
                </span>
                <button
                  type="button"
                  onClick={p.onCloseCard}
                  className="press grid size-9 place-items-center rounded-full bg-secondary"
                  aria-label="Close the card checkout"
                >
                  <X className="size-4" />
                </button>
              </div>
              <Stage className="p-2 sm:p-3" grid={false}>
                <iframe
                  src={p.cardUrl}
                  title="Card checkout by Transak"
                  allow="camera;microphone;payment;clipboard-write"
                  className="h-[680px] w-full rounded-[16px] bg-white"
                />
              </Stage>
              <p className="px-1 text-center text-[13px] text-muted-foreground">
                Your card goes to Transak, not to {p.request.business} or Tegata.
              </p>
            </motion.div>
          ) : p.step === "paying" && p.usedRail === "card" ? (
            <motion.div key="card-paying" className="flex flex-col gap-4" {...slide}>
              <Stage className="p-3 sm:p-4" grid={false}>
                <Paper className="p-2">
                  <TaskSteps steps={CARD_STEPS} current={p.progress} tone="paper" />
                </Paper>
              </Stage>
              <div className="flex justify-center">
                <WaitingText
                  verb={p.progress >= 1 ? "Sending as USDC on NEAR" : "Waiting for the card"}
                  startedAt={p.startedAt}
                />
              </div>
            </motion.div>
          ) : p.step === "paying" && p.usedRail === "oneclick" && p.attempt?.oneclick ? (
            <motion.div key="deposit" className="flex flex-col gap-4" {...slide}>
              <DepositPanel oneclick={p.attempt.oneclick} business={p.request.business} />
            </motion.div>
          ) : p.step === "paying" ? (
            <motion.div key="paying" className="flex flex-col gap-4" {...slide}>
              <Stage className="p-3 sm:p-4" grid={false}>
                <Paper className="p-2">
                  <TaskSteps
                    steps={p.usedRail === "near_wallet" ? WALLET_STEPS : TEGATA_STEPS}
                    current={p.progress}
                    tone="paper"
                  />
                </Paper>
              </Stage>
              <div className="flex justify-center">
                <WaitingText verb="Checking NEAR" startedAt={p.startedAt} />
              </div>
            </motion.div>
          ) : p.step === "paid" ? (
            <motion.div key="paid" className="flex flex-col gap-4" {...slide}>
              <PaidSlip {...p} dollars={dollars} />
              <div className="grid grid-cols-1 gap-2">
                {p.request.successUrl ? (
                  <Button asChild>
                    <a href={p.request.successUrl}>Back to {p.request.business}</a>
                  </Button>
                ) : null}
                {p.attempt?.receiptToken ? (
                  <Button variant={p.request.successUrl ? "secondary" : "primary"} asChild>
                    <Link href={`/r/${p.attempt.receiptToken}`}>
                      <ReceiptText /> View your receipt
                    </Link>
                  </Button>
                ) : null}
              </div>
            </motion.div>
          ) : (
            <motion.div key="failed" className="flex flex-col gap-4" {...slide}>
              <ErrorState
                title="That payment didn't go through"
                detail={p.problem ?? "NEAR didn't settle it."}
                stillWorks={
                  p.usedRail === "near_wallet"
                    ? "If your wallet shows it sent, keep its transaction link."
                    : "No money left your balance."
                }
                onRetry={p.onTryAgain}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="flex flex-col items-center gap-2 pt-4 text-meta text-muted-foreground">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Mark id="near" size={16} /> Settled on NEAR
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Mark id="intents" size={16} /> Powered by NEAR Intents
            </span>
          </span>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-semibold hover:text-foreground"
          >
            <TegataSeal size={14} textured={false} tilt={0} /> Tegata
          </Link>
        </footer>
      </div>
    </div>
  )
}

function RailRow({
  selected,
  onSelect,
  art,
  title,
  detail,
  badge,
  children,
}: {
  selected: boolean
  onSelect: () => void
  art: React.ReactNode
  title: string
  detail: string
  badge?: string
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[20px] bg-card transition-shadow duration-150",
        selected && "shadow-[0_0_0_2px_var(--shu)]",
      )}
    >
      <button
        type="button"
        aria-expanded={selected}
        onClick={() => {
          fire("tick", { cue: "toggle" })
          onSelect()
        }}
        className="press flex w-full items-center gap-4 p-4 text-left"
      >
        <span className="flex h-12 min-w-12 shrink-0 items-center justify-center">{art}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="text-[17px] font-semibold">{title}</span>
            {badge ? (
              <span className="rounded-full bg-shu-wash px-2 py-0.5 text-[12px] font-semibold text-shu-ink">
                {badge}
              </span>
            ) : null}
          </span>
          <span className="truncate text-detail text-muted-foreground">{detail}</span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-text-3 transition-transform duration-200",
            selected && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {selected ? (
          <motion.div
            key="panel"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

type PanelProps = PayViewProps & { dollars: number }

/** Transak's published staging card, so anyone can try paying by card in the Sandbox. */
const TEST_CARD = "4242 4242 4242 4242"

function CardPayPanel(p: PanelProps) {
  const [copied, setCopied] = useState(false)
  const card = p.card
  if (!card) return null
  const sandbox = p.request.network === "testnet"
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: card.quote?.fiat ?? "EUR",
      currencyDisplay: "narrowSymbol",
    }).format(n)
  if (!card.open)
    return (
      <p className="rounded-[14px] bg-secondary px-4 py-3 text-[15px] text-muted-foreground">
        {card.reason ?? "Card payments open soon. The other ways work now."}
      </p>
    )
  return (
    <>
      <div className="flex flex-col divide-y divide-border rounded-[16px] bg-secondary px-4">
        <div className="flex items-center justify-between gap-3 py-3 text-[15px]">
          <span className="text-muted-foreground">{p.request.business} gets</span>
          <span className="tnum font-semibold">{usd(p.dollars)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-3 text-[15px]">
          <span className="text-muted-foreground">Card fee, set by Transak</span>
          <span className="tnum font-semibold">
            {card.quote ? `about ${money(card.quote.fee)}` : card.loading ? "…" : "shown next"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-[15px] font-semibold">You pay</span>
          <span className="tnum text-[17px] font-bold">
            {card.quote ? `about ${money(card.quote.total)}` : card.loading ? "…" : "—"}
          </span>
        </div>
      </div>
      <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
        <IdCard className="size-4 shrink-0" /> First time? Transak may ask for a photo ID.
      </p>
      {sandbox ? (
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(TEST_CARD.replace(/ /g, ""))
            fire("tick", { cue: "confirmed" })
            setCopied(true)
            setTimeout(() => setCopied(false), 1400)
          }}
          className="press flex items-center gap-3 rounded-[14px] border border-dashed border-border px-3 py-2.5 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13px] text-muted-foreground">
              Sandbox test card · 10/33 · CVV 100
            </span>
            <span className="font-mono text-[15px] font-semibold">{TEST_CARD}</span>
          </span>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      ) : null}
      <Problem text={p.problem} />
      <Button busy={p.busy} disabled={p.dollars <= 0} onClick={p.onPayCard}>
        <CreditCard />{" "}
        {card.quote
          ? `Pay about ${money(card.quote.total)} by card`
          : `Pay ${usd(p.dollars)} by card`}
      </Button>
      <p className="text-center text-[13px] text-muted-foreground">
        Your card goes to Transak, not to {p.request.business} or Tegata.
      </p>
    </>
  )
}

function Problem({ text }: { text: string | null }) {
  return text ? <p className="text-[15px] font-medium text-down">{text}</p> : null
}

function FromRow({
  label,
  account,
  aside,
}: {
  label: string
  account: string
  aside?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] bg-secondary px-4 py-3">
      <span className="flex min-w-0 flex-col">
        <span className="text-detail text-muted-foreground">{label}</span>
        <span className="truncate font-mono text-[15px] font-medium">{account}</span>
      </span>
      {aside}
    </div>
  )
}

function TegataPanel(p: PanelProps) {
  const t = p.tegata
  if (t.kind === "loading")
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading your account">
        <Skeleton className="h-[62px] w-full rounded-[14px]" />
        <Skeleton className="h-14 w-full rounded-[14px]" />
      </div>
    )
  if (t.kind === "signed_out")
    return (
      <Button onClick={p.onSignIn} cue="tap">
        Sign in to pay
      </Button>
    )
  if (t.kind === "no_account")
    return (
      <Button onClick={p.onFinishAccount} cue="tap">
        Open my account · 10 s
      </Button>
    )
  if (t.kind === "own_link")
    return (
      <FromRow
        label="Signed in as"
        account={t.accountId}
        aside={<span className="text-detail font-medium text-warn">Your own link</span>}
      />
    )
  const short = t.balance < p.dollars
  return (
    <>
      <FromRow
        label="From"
        account={t.accountId}
        aside={
          <span className={cn("tnum text-[15px] font-semibold", short && "text-warn")}>
            {usd(t.balance)}
          </span>
        }
      />
      {short ? (
        <p className="text-[15px] font-medium text-warn">
          {p.testDollars?.state === "failed" && p.testDollars.error
            ? p.testDollars.error
            : `You have ${usd(t.balance)}. Add dollars to your Tegata account first.`}
        </p>
      ) : null}
      {short && p.testDollars && p.onAddTestDollars && p.testDollars.state !== "sent" ? (
        <Button
          variant="secondary"
          onClick={p.onAddTestDollars}
          busy={p.testDollars.state === "sending"}
        >
          <Plus /> Add $5.00 test dollars
        </Button>
      ) : null}
      <Problem text={p.problem} />
      <HoldButton
        label={p.dollars > 0 ? `Hold to pay ${usd(p.dollars)}` : "Enter an amount"}
        busy={p.busy || short || p.dollars <= 0}
        onConfirm={p.onPayTegata}
      />
    </>
  )
}

function WalletPanel(p: PanelProps) {
  if (!p.walletAccount)
    return (
      <>
        <Problem text={p.problem} />
        <Button variant="secondary" onClick={p.onConnect} busy={p.connecting}>
          <Wallet /> Connect a NEAR wallet
        </Button>
      </>
    )
  return (
    <>
      <FromRow
        label="From your wallet"
        account={p.walletAccount}
        aside={
          <button
            type="button"
            onClick={p.onDisconnect}
            className="shrink-0 text-detail font-semibold text-shu-ink hover:underline"
          >
            Change
          </button>
        }
      />
      <ReceiptEmailField p={p} />
      <Problem text={p.problem} />
      <Button onClick={p.onPayWallet} busy={p.busy} disabled={p.dollars <= 0} cue="tap">
        {p.dollars > 0 ? `Pay ${usd(p.dollars)} from your wallet` : "Enter an amount"}
      </Button>
    </>
  )
}

function ChainPanel(p: PanelProps) {
  const route = p.routes.find((r) => r.id === p.routeId) ?? p.routes[0]
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {p.routes.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              fire("tick")
              p.onRoute(r.id)
            }}
            aria-pressed={r.id === p.routeId}
            className={cn(
              "press flex flex-col items-center gap-1.5 rounded-[14px] bg-secondary px-2 py-3 text-center",
              r.id === p.routeId && "bg-card shadow-[0_0_0_2px_var(--shu)]",
            )}
          >
            <Mark id={r.coin} chain={r.chainMark} size={30} />
            <span className="text-[13px] font-semibold leading-tight">
              {r.symbol}
              <span className="block font-medium text-muted-foreground">{r.chain}</span>
            </span>
          </button>
        ))}
      </div>
      {route ? (
        <div className="flex flex-col gap-1 rounded-[14px] bg-secondary px-4 py-3">
          <span className="flex items-center justify-between text-detail text-muted-foreground">
            <span>You would send</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-up" /> Live quote
            </span>
          </span>
          {p.dollars <= 0 ? (
            <span className="text-[17px] font-semibold text-text-3">Enter an amount</span>
          ) : p.quote.data ? (
            <span className="flex items-center justify-between gap-3">
              <span className="tnum inline-flex min-w-0 items-center gap-2 text-[20px] font-semibold">
                <Mark id={route.coin} chain={route.chainMark} size={22} />
                <span className="truncate">
                  {coinAmount(p.quote.data.amountInFormatted, route.symbol)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-detail text-muted-foreground">
                <Clock3 className="size-3.5" /> {eta(p.quote.data.timeEstimate)}
              </span>
            </span>
          ) : p.quote.error ? (
            <span className="text-[15px] font-medium text-warn">{p.quote.error}</span>
          ) : (
            <TextShimmer className="text-[17px]">Asking NEAR Intents…</TextShimmer>
          )}
        </div>
      ) : null}
      {p.request.network === "mainnet" && route ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            p.onPayChain()
          }}
        >
          <Field
            id="refund-to"
            label={`Refund address on ${route.chain}`}
            placeholder={REFUND_HINT[route.chainMark] ?? "Your address"}
            value={p.refundTo}
            onChange={(e) => p.onRefundTo(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            className="font-mono"
          />
          <ReceiptEmailField p={p} />
          <Problem text={p.problem} />
          <Button
            type="submit"
            cue="tap"
            busy={p.busy}
            disabled={p.dollars <= 0 || p.refundTo.trim().length < 10 || !p.quote.data}
          >
            Get the deposit address
          </Button>
        </form>
      ) : (
        <SandboxPill>
          <Mark id="intents" size={16} /> Live only · real price
        </SandboxPill>
      )}
    </>
  )
}

/** "Email me a receipt", optional: the receipt (and any refund notice) goes there. */
function ReceiptEmailField({ p }: { p: PanelProps }) {
  if (!p.onReceiptEmail) return null
  return (
    <Field
      id="receipt-email"
      label="Email me a receipt (optional)"
      type="email"
      inputMode="email"
      autoComplete="email"
      placeholder="you@example.com"
      value={p.receiptEmail ?? ""}
      onChange={(e) => p.onReceiptEmail?.(e.target.value)}
    />
  )
}

/** What an address looks like on each chain, as a placeholder. */
const REFUND_HINT: Record<string, string> = {
  eth: "0x…",
  base: "0x…",
  arb: "0x…",
  bnb: "0x…",
  pol: "0x…",
  gnosis: "0x…",
  sol: "Your Solana address",
  btc: "bc1…",
  tron: "T…",
}

/** The paid slip: the receipt's own paper on the stage, stamped PAID with the "received" cue, once. */
function PaidSlip(p: PanelProps) {
  const rail = p.usedRail ?? "tegata"
  const assetIn = p.attempt?.oneclick?.assetIn ?? null
  const when = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
  const paidWith =
    rail === "near_wallet"
      ? "NEAR wallet"
      : rail === "oneclick"
        ? (paidVia(assetIn) ?? "Another chain")
        : rail === "manual"
          ? "By hand"
          : "Tegata balance"
  return (
    <Stage className="p-3 sm:p-4" grid={false}>
      <ReceiptSlip
        label="Paid"
        amount={p.dollars}
        sub={
          <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-black">
            {p.request.logo ? (
              <img src={p.request.logo} alt="" className="size-[22px] rounded-full object-cover" />
            ) : (
              <BusinessSeal name={p.request.business} size={22} tilt={0} />
            )}
            <span className="truncate">{p.request.business}</span>
          </span>
        }
        seal={
          <SealPress
            delay={0.2}
            onLanded={() => fire("filled", { cue: "received", identity: p.attempt?.id })}
          >
            <BusinessSeal name={p.request.business} band="Paid" size={96} />
          </SealPress>
        }
      >
        <SlipRow label="For">{p.request.title}</SlipRow>
        <SlipRow label="Paid with">
          <span className="inline-flex items-center gap-1.5">
            <PaidWithMark rail={rail} assetIn={assetIn} size={18} /> {paidWith}
          </span>
        </SlipRow>
        {rail === "oneclick" ? (
          <SlipRow label="Converted by">
            <span className="inline-flex items-center gap-1.5">
              <Mark id="intents" size={18} /> NEAR Intents
            </span>
          </SlipRow>
        ) : null}
        <SlipRow label="Settled">{when}</SlipRow>
        <SlipRow label="Network fee">
          {rail === "tegata"
            ? "Paid by Tegata"
            : rail === "oneclick"
              ? "In the price you sent"
              : "Paid by your wallet"}
        </SlipRow>
        {p.attempt?.explorerUrl ? (
          <SlipRow label="Transaction">
            <a
              href={p.attempt.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-paper-seal hover:underline"
            >
              See it on NEAR <ExternalLink className="size-3.5" />
            </a>
          </SlipRow>
        ) : null}
      </ReceiptSlip>
    </Stage>
  )
}
