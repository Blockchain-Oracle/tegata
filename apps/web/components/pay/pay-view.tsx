"use client"

// The pay page (plan 6.8 D and D′), phone first: the business and the amount on the stage, then three ways to pay
// as large rows with real marks (Tegata balance, a NEAR wallet, another chain through NEAR Intents), then live steps
// and a sealed slip once NEAR has settled it. No app chrome: the business's seal at the top, NEAR at the foot.
// Separate from its logic so /dev/flows can show every state.
import {
  ChevronDown,
  Clock3,
  ExternalLink,
  KeyRound,
  Lock,
  Plus,
  Radio,
  ReceiptText,
  Wallet,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"

import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Paper, Stage } from "@/components/kit/stage"
import { ErrorState, Skeleton, TextShimmer, WaitingText } from "@/components/kit/states"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark, type MarkId, MarkStack } from "@/components/marks/mark"
import type { TestDollars } from "@/hooks/use-test-dollars"
import type { AttemptView, PaymentRail, PublicRequest } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
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
}

const TEGATA_STEPS = [
  {
    id: "sign",
    label: "Approved with your key",
    detail: "signed on this device",
    icon: <KeyRound />,
  },
  { id: "relay", label: "Sent by Tegata", detail: "network fee paid by Tegata", icon: <Radio /> },
  {
    id: "near",
    label: "Checked on NEAR",
    detail: "the USDC transfer to the business",
    mark: "near" as const,
  },
]

const WALLET_STEPS = [
  { id: "wallet", label: "Sent from your wallet", detail: "one USDC transfer", icon: <Wallet /> },
  {
    id: "near",
    label: "Checked on NEAR",
    detail: "the USDC transfer to the business",
    mark: "near" as const,
  },
  { id: "receipt", label: "Receipt issued", detail: "numbered and sealed", icon: <ReceiptText /> },
]

export function PayView(p: PayViewProps) {
  const reduce = useReducedMotion()
  const fixed = p.request.amount !== null
  const dollars = fixed ? viewDollars(p.request.amount!) : Number.parseFloat(p.amount || "0") || 0
  const open = p.request.status === "open"
  const sandbox = p.request.network === "testnet"
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
              <span className="ml-auto shrink-0 rounded-full border border-dashed border-white/80 px-3 py-1 text-[12px] font-semibold text-white">
                Sandbox
              </span>
            ) : null}
          </div>
          <div className="mt-7 flex flex-col items-center gap-1.5 text-center">
            <span className="text-[16px] font-medium text-white/90">{p.request.title}</span>
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
            {p.request.note ? (
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
              <Paper className="flex flex-col items-center gap-3 p-8 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-[#F5F5F5]">
                  <Lock className="size-6" />
                </span>
                <span className="text-[18px] font-semibold">
                  {p.request.status === "paid"
                    ? "This link has been paid"
                    : "This link isn't taking payments"}
                </span>
                <span className="text-[15px] text-[#666]">
                  Ask {p.request.business} for a new link if you still owe them.
                </span>
              </Paper>
            </motion.div>
          ) : p.step === "choose" ? (
            <motion.section key="choose" className="flex flex-col gap-3" {...slide}>
              <h2 className="px-1 text-section-title font-semibold">How do you want to pay?</h2>
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
                detail="HOT, Meteor, MyNearWallet, Intear"
              >
                <WalletPanel {...p} dollars={dollars} />
              </RailRow>
              <RailRow
                selected={p.rail === "oneclick"}
                onSelect={() => p.onRail(p.rail === "oneclick" ? null : "oneclick")}
                art={<MarkStack ids={["eth", "sol", "btc"]} size={30} />}
                title="Another chain"
                detail="USDT, USDC, BTC, ETH… on 10 chains"
              >
                <ChainPanel {...p} dollars={dollars} />
              </RailRow>
            </motion.section>
          ) : p.step === "paying" ? (
            <motion.div key="paying" className="flex flex-col gap-4" {...slide}>
              <div className="rounded-[20px] bg-secondary p-2">
                <TaskSteps
                  steps={p.usedRail === "near_wallet" ? WALLET_STEPS : TEGATA_STEPS}
                  current={p.progress}
                />
              </div>
              <div className="flex justify-center">
                <WaitingText verb="Checking NEAR" startedAt={p.startedAt} />
              </div>
            </motion.div>
          ) : p.step === "paid" ? (
            <motion.div key="paid" className="flex flex-col gap-4" {...slide}>
              <PaidSlip {...p} dollars={dollars} />
              <div className="grid grid-cols-1 gap-2">
                {p.attempt?.receiptToken ? (
                  <Button asChild>
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
        <span className="grid size-12 shrink-0 place-items-center">{art}</span>
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
      <>
        <p className="text-[15px] text-muted-foreground">
          Sign in with your email to pay from your Tegata dollars. Tegata pays the network fee.
        </p>
        <Button onClick={p.onSignIn} cue="tap">
          Sign in to pay
        </Button>
      </>
    )
  if (t.kind === "no_account")
    return (
      <>
        <p className="text-[15px] text-muted-foreground">
          Your Tegata account isn't open yet. It takes about ten seconds.
        </p>
        <Button onClick={p.onFinishAccount} cue="tap">
          Open my account
        </Button>
      </>
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
            ${t.balance.toFixed(2)}
          </span>
        }
      />
      {short ? (
        <p className="text-[15px] font-medium text-warn">
          {p.testDollars?.state === "failed" && p.testDollars.error
            ? p.testDollars.error
            : `You have $${t.balance.toFixed(2)}. Add dollars to your Tegata account first.`}
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
        label={p.dollars > 0 ? `Hold to pay $${p.dollars.toFixed(2)}` : "Enter an amount"}
        busy={p.busy || short || p.dollars <= 0}
        onConfirm={p.onPayTegata}
      />
    </>
  )
}

function WalletPanel(p: PanelProps) {
  const sandbox = p.request.network === "testnet"
  if (!p.walletAccount)
    return (
      <>
        <p className="text-[15px] text-muted-foreground">
          {sandbox
            ? "Use a wallet on NEAR testnet that holds test USDC."
            : "Any NEAR wallet holding USDC, or an Ethereum wallet through NEAR."}
        </p>
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
      <Problem text={p.problem} />
      <Button onClick={p.onPayWallet} busy={p.busy} disabled={p.dollars <= 0} cue="tap">
        {p.dollars > 0 ? `Pay $${p.dollars.toFixed(2)} from your wallet` : "Enter an amount"}
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
            <Mark id={r.coin as MarkId} chain={r.chainMark as MarkId} size={30} />
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
              <span className="tnum text-[20px] font-semibold">
                {p.quote.data.amountInFormatted} {route.symbol}
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
      <div className="flex items-start gap-3 rounded-[14px] bg-sora/60 px-4 py-3 text-black">
        <Mark id="intents" size={24} />
        <p className="text-[14px]">
          {p.request.network === "testnet"
            ? "Paying from other chains runs in Live: NEAR Intents has no testnet. The price above is real."
            : "Deposit addresses open once Live is switched on for this business."}
        </p>
      </div>
    </>
  )
}

function eta(seconds: number) {
  if (seconds < 90) return `about ${Math.max(10, Math.round(seconds / 10) * 10)} s`
  return `about ${Math.round(seconds / 60)} min`
}

/** The paid slip: paper, perforation, the business seal stamped PAID with the "received" cue, once. */
function PaidSlip(p: PanelProps) {
  const rail = p.usedRail ?? "tegata"
  const when = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
  const railMark: MarkId = rail === "near_wallet" ? "near" : "usdc"
  return (
    <div className="relative rounded-[20px] bg-white text-black shadow-receipt">
      <div className="p-6 pb-4">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-[#666]">
          <TegataSeal size={20} textured={false} /> Paid
        </span>
        <Figure value={p.dollars} className="mt-3 flex text-[56px]" />
        <div className="mt-2 flex items-center gap-2 text-[15px] font-semibold">
          <Mark id="near" size={22} /> {p.request.business}
        </div>
      </div>
      <div className="relative h-4">
        <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-background" />
        <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-background" />
        <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-[#E2E2E2]" />
      </div>
      <div className="flex flex-col gap-2.5 p-6 pt-3 text-[14px]">
        <SlipRow label="For">{p.request.title}</SlipRow>
        <SlipRow label="Paid with">
          <span className="inline-flex items-center gap-1.5">
            <Mark id={railMark} size={16} />{" "}
            {rail === "near_wallet" ? "NEAR wallet" : "Tegata balance"}
          </span>
        </SlipRow>
        <SlipRow label="Settled">{when}</SlipRow>
        <SlipRow label="Network fee">
          {rail === "tegata" ? "Paid by Tegata" : "Paid by your wallet"}
        </SlipRow>
        {p.attempt?.explorerUrl ? (
          <a
            href={p.attempt.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 self-start font-semibold text-[#B23700] hover:underline"
          >
            See it on NEAR <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
      <div className="absolute top-4 right-4">
        <SealPress
          delay={0.2}
          onLanded={() => fire("filled", { cue: "received", identity: p.attempt?.id })}
        >
          <BusinessSeal name={p.request.business} band="Paid" size={96} />
        </SealPress>
      </div>
    </div>
  )
}

function SlipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#666]">{label}</span>
      <span className="truncate text-right font-semibold">{children}</span>
    </div>
  )
}
