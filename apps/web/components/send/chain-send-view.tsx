"use client"

// Send to another chain, in Live (plan 6.8 AB): the business sends an exact dollar amount from its USDC on NEAR and the
// person receives the coin they asked for, on their chain, through NEAR Intents. Amount on the stage, a coin-and-chain
// grid with real marks, their address, a live quote of what arrives; a review paper from the committed quote; hold to
// send (one gas-free transfer); steps to delivery; a receipt with both transactions. Separate from its logic so
// /dev/flows can show every state.
import { ArrowLeft, Clock3, ExternalLink, KeyRound, ScanLine, Undo2 } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import type { ReactNode } from "react"

import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Paper, Stage } from "@/components/kit/stage"
import { ErrorState, TextShimmer } from "@/components/kit/states"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark } from "@/components/marks/mark"
import type { PayoutPreview, PayoutView } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { ADDRESS_HINT, addressLooksRight, chainTxUrl, eta } from "@/lib/routes"
import { cn } from "@/lib/utils"

export type ChainSendStep = "form" | "review" | "sending" | "delivered" | "refunded" | "failed"

export interface ChainRoute {
  id: string
  symbol: string
  chain: string
  coin: string
  chainMark: string
}

export interface ChainSendViewProps {
  step: ChainSendStep
  routes: readonly ChainRoute[]
  routeId: string
  onRoute: (id: string) => void
  to: string
  onTo: (value: string) => void
  amount: string
  onAmount: (value: string) => void
  /** USDC balance in dollars. */
  balance: number
  businessName: string
  /** The live quote for what arrives, while filling in the form. */
  preview: { data?: PayoutPreview; error?: string | null; loading: boolean }
  /** The committed payout, from review onwards. */
  payout: PayoutView | null
  /** 0 approving, 1 on NEAR, 2 picked up by NEAR Intents, 3 delivering, 4 delivered. */
  progress: number
  busy: boolean
  problem: string | null
  /** Shown under the title on the form: NEAR account / Another chain. */
  switcher?: ReactNode
  /** Open the QR scanner for the address. */
  onScan?: () => void
  onReview: () => void
  onApprove: () => void
  onEdit: () => void
  onAgain: () => void
  onReceive: () => void
}

const short = (address: string) =>
  address.length > 16 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address

export function ChainSendView(p: ChainSendViewProps) {
  const reduce = useReducedMotion()
  const route = p.routes.find((r) => r.id === p.routeId) ?? p.routes[0]
  const value = Number.parseFloat(p.amount || "0") || 0
  const over = value > p.balance
  const empty = p.balance <= 0
  const addressOk = route ? addressLooksRight(route.chainMark, p.to) : false
  const addressBad = p.to.trim().length > 0 && !addressOk
  const slide = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as const },
  }
  if (!route) return null

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
      detail: "on NEAR · network fee paid by Tegata",
      mark: "near" as const,
    },
    {
      id: "intents",
      label: "Picked up by NEAR Intents",
      detail: `USDC to ${route.symbol}`,
      mark: "intents" as const,
    },
    {
      id: "chain",
      label: `Delivered on ${route.chain}`,
      detail: p.payout?.timeEstimate ? eta(p.payout.timeEstimate) : "a few minutes",
      icon: <Mark id={route.chainMark} size={20} />,
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
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
        ) : (
          <Link
            href="/app"
            className="press grid size-10 place-items-center rounded-full bg-secondary hover:bg-plate-pressed"
            aria-label="Home"
          >
            <ArrowLeft className="size-4" />
          </Link>
        )}
        <h1 className="display text-page-title">Send</h1>
      </div>
      {p.step === "form" ? p.switcher : null}

      <AnimatePresence mode="wait" initial={false}>
        {p.step === "form" ? (
          <motion.form
            key="form"
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (!empty) p.onReview()
            }}
            {...slide}
          >
            <Stage className="px-5 py-9">
              <div className="flex flex-col items-center gap-2">
                <label htmlFor="chain-amount" className="text-[15px] font-medium text-white/85">
                  You send
                </label>
                <div className="flex items-baseline justify-center">
                  <span
                    className={cn("figure text-[56px]", value > 0 ? "text-white" : "text-white/55")}
                  >
                    $
                  </span>
                  <input
                    id="chain-amount"
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
                <div className="flex items-center gap-2 rounded-full bg-white/18 py-1 pr-1 pl-2.5 text-[14px] text-white">
                  <Mark id="usdc" chain="near" size={18} />
                  <span className={cn(over && "font-semibold")}>
                    {over ? "More than your " : "You have "}${p.balance.toFixed(2)}
                  </span>
                  {!empty ? (
                    <button
                      type="button"
                      onClick={() => {
                        fire("tick")
                        p.onAmount(p.balance.toString())
                      }}
                      className="press rounded-full bg-white px-2.5 py-1 text-[13px] font-semibold text-black"
                    >
                      All
                    </button>
                  ) : null}
                </div>
              </div>
            </Stage>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[15px] font-semibold">They receive</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
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
            </fieldset>

            <Field
              id="chain-to"
              label={`Their address on ${route.chain}`}
              placeholder={ADDRESS_HINT[route.chainMark] ?? "Their address"}
              value={p.to}
              onChange={(e) => p.onTo(e.target.value.trim())}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              className="font-mono"
              leading={<Mark id={route.chainMark} size={24} />}
              trailing={
                p.onScan ? (
                  <button
                    type="button"
                    onClick={p.onScan}
                    aria-label="Scan a QR code"
                    className="press grid size-10 place-items-center rounded-full bg-card [&_svg]:size-5"
                  >
                    <ScanLine />
                  </button>
                ) : null
              }
              status={
                p.problem
                  ? { kind: "bad", text: p.problem }
                  : addressBad
                    ? { kind: "bad", text: `That isn't a ${route.chain} address` }
                    : { kind: "none" }
              }
            />

            <div className="flex flex-col gap-1 rounded-[14px] bg-secondary px-4 py-3">
              <span className="flex items-center justify-between text-detail text-muted-foreground">
                <span>They get</span>
                <span className="inline-flex items-center gap-1.5">
                  <Mark id="intents" size={14} /> Live quote from NEAR Intents
                </span>
              </span>
              {value <= 0 ? (
                <span className="text-[17px] font-semibold text-text-3">Enter an amount</span>
              ) : !addressOk ? (
                <span className="text-[17px] font-semibold text-text-3">
                  Enter their address to see what arrives
                </span>
              ) : p.preview.data ? (
                <span className="flex items-center justify-between gap-3">
                  <span className="tnum inline-flex items-center gap-2 text-[20px] font-semibold">
                    <Mark id={route.coin} chain={route.chainMark} size={22} />
                    {p.preview.data.amountOutFormatted} {route.symbol}
                  </span>
                  {p.preview.data.timeEstimate ? (
                    <span className="inline-flex items-center gap-1 text-detail text-muted-foreground">
                      <Clock3 className="size-3.5" /> {eta(p.preview.data.timeEstimate)}
                    </span>
                  ) : null}
                </span>
              ) : p.preview.error ? (
                <span className="text-[15px] font-medium text-warn">{p.preview.error}</span>
              ) : (
                <TextShimmer className="text-[17px]">Asking NEAR Intents…</TextShimmer>
              )}
            </div>

            {empty ? (
              <Button type="button" variant="shu" cue="tap" onClick={p.onReceive}>
                Add dollars first
              </Button>
            ) : (
              <Button
                type="submit"
                busy={p.busy}
                disabled={value <= 0 || over || !addressOk || !p.preview.data}
              >
                {value > 0 ? `Review $${value.toFixed(2)}` : "Enter an amount"}
              </Button>
            )}
          </motion.form>
        ) : p.step === "review" && p.payout ? (
          <motion.div key="review" className="flex flex-col gap-5" {...slide}>
            <Stage className="p-4 sm:p-6">
              <Paper className="flex flex-col gap-1 p-6">
                <span className="text-detail font-medium text-[#666]">You send exactly</span>
                <Figure value={value} className="text-[64px]" />
                <div className="mt-4 flex flex-col divide-y divide-[#ECECEC] text-[15px]">
                  <Row label="To">
                    <span className="inline-flex items-center gap-2 font-mono font-medium">
                      <Mark id={route.chainMark} size={18} /> {short(p.payout.recipient)}
                    </span>
                  </Row>
                  <Row label="They receive">
                    <span className="tnum inline-flex items-center gap-1.5 font-semibold">
                      <Mark id={route.coin} chain={route.chainMark} size={18} /> about{" "}
                      {p.payout.amountOutFormatted} {route.symbol}
                    </span>
                  </Row>
                  <Row label="Arrives">
                    <span className="font-semibold">
                      {p.payout.timeEstimate ? eta(p.payout.timeEstimate) : "In minutes"}, on{" "}
                      {route.chain}
                    </span>
                  </Row>
                  <Row label="Network fee">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <TegataSeal size={18} textured={false} /> Paid by Tegata
                    </span>
                  </Row>
                </div>
                <p className="mt-3 flex items-start gap-2 text-[13px] text-[#666]">
                  <Mark id="intents" size={16} className="mt-0.5" />
                  Converted by NEAR Intents. If it can't be delivered, the USDC comes back to your
                  balance.
                </p>
              </Paper>
            </Stage>
            {p.problem ? <p className="text-[15px] font-medium text-down">{p.problem}</p> : null}
            <HoldButton
              label={`Hold to send $${value.toFixed(2)}`}
              busy={p.busy}
              onConfirm={p.onApprove}
            />
          </motion.div>
        ) : p.step === "sending" ? (
          <motion.div key="sending" className="flex flex-col gap-5" {...slide}>
            <div className="flex flex-col items-center gap-1 rounded-[24px] bg-card p-6 text-center">
              <span className="inline-flex items-center gap-1.5 text-detail font-medium text-muted-foreground">
                Sending to <Mark id={route.chainMark} size={16} />{" "}
                <span className="font-mono">{short(p.payout?.recipient ?? p.to)}</span>
              </span>
              <Figure value={value} className="text-[56px]" />
            </div>
            <div className="rounded-[20px] bg-secondary p-2">
              <TaskSteps steps={steps} current={p.progress} />
            </div>
          </motion.div>
        ) : p.step === "delivered" && p.payout ? (
          <motion.div key="delivered" className="flex flex-col gap-5" {...slide}>
            <Delivered
              payout={p.payout}
              route={route}
              value={value}
              businessName={p.businessName}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={p.onAgain}>
                Send again
              </Button>
              <Button asChild>
                <Link href="/app">Done</Link>
              </Button>
            </div>
          </motion.div>
        ) : p.step === "refunded" ? (
          <motion.div key="refunded" className="flex flex-col gap-5" {...slide}>
            <div className="flex flex-col items-start gap-3 rounded-[20px] bg-card p-6 shadow-[0_0_0_1px_var(--border)]">
              <span className="grid size-11 place-items-center rounded-full bg-warn-surface text-warn">
                <Undo2 className="size-5" />
              </span>
              <h2 className="text-[20px] font-semibold">Couldn't deliver it to {route.chain}</h2>
              <p className="text-[15px] text-muted-foreground">
                NEAR Intents couldn't complete the conversion in time, so the ${value.toFixed(2)}{" "}
                came back to your balance on NEAR.
              </p>
              <Button variant="secondary" onClick={p.onEdit}>
                Try again
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="failed" className="flex flex-col gap-5" {...slide}>
            <ErrorState
              title="That payment wasn't sent"
              detail={p.problem ?? "NEAR didn't accept it."}
              stillWorks={
                p.payout?.txHash
                  ? "If any USDC left your balance, NEAR Intents returns it."
                  : "No money left your balance."
              }
              onRetry={p.onEdit}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[#666]">{label}</span>
      {children}
    </div>
  )
}

/** The receipt slip for a payout: what left NEAR, what was quoted to arrive, both transactions, the seal pressed once. */
function Delivered({
  payout,
  route,
  value,
  businessName,
}: {
  payout: PayoutView
  route: ChainRoute
  value: number
  businessName: string
}) {
  const when = new Date(payout.deliveredAt ?? Date.now()).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
  const destination = payout.destinationTx
    ? chainTxUrl(route.chainMark, payout.destinationTx)
    : null
  return (
    <div className="relative rounded-[20px] bg-white text-black shadow-receipt">
      <div className="p-6 pb-4">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-[#666]">
          <TegataSeal size={20} textured={false} /> Receipt · Delivered
        </span>
        <Figure value={value} className="mt-3 flex text-[56px]" />
        <div className="mt-2 flex items-center gap-2 font-mono text-[15px] font-semibold">
          <Mark id={route.chainMark} size={22} /> {short(payout.recipient)}
        </div>
      </div>
      <div className="relative h-4">
        <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-background" />
        <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-background" />
        <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-[#E2E2E2]" />
      </div>
      <div className="flex flex-col gap-2.5 p-6 pt-3 text-[14px]">
        <SlipRow label="Route">
          <span className="inline-flex items-center gap-1.5">
            <Mark id="usdc" chain="near" size={16} /> USDC on NEAR →{" "}
            <Mark id={route.coin} chain={route.chainMark} size={16} /> {route.symbol} on{" "}
            {route.chain}
          </span>
        </SlipRow>
        <SlipRow label="Quoted to arrive">
          {payout.amountOutFormatted} {route.symbol}
        </SlipRow>
        <SlipRow label="Converted by">
          <span className="inline-flex items-center gap-1.5">
            <Mark id="intents" size={16} /> NEAR Intents
          </span>
        </SlipRow>
        <SlipRow label="From">{businessName}</SlipRow>
        <SlipRow label="Delivered">{when}</SlipRow>
        <SlipRow label="Network fee">Paid by Tegata</SlipRow>
        <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          {payout.txHash ? (
            <a
              href={`https://nearblocks.io/txns/${payout.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-[#B23700] hover:underline"
            >
              On NEAR <ExternalLink className="size-3.5" />
            </a>
          ) : null}
          {destination ? (
            <a
              href={destination}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-[#B23700] hover:underline"
            >
              On {route.chain} <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </span>
      </div>
      <div className="absolute top-4 right-4">
        <SealPress
          delay={0.2}
          onLanded={() => fire("filled", { cue: "sent", identity: payout.id })}
        >
          <BusinessSeal name={businessName} band="Sent" size={96} />
        </SealPress>
      </div>
    </div>
  )
}

function SlipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#666]">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  )
}
