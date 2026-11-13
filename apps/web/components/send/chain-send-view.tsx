"use client"

// Send to another chain, in Live: the business sends an exact dollar amount from its USDC on NEAR and the
// person receives the coin they asked for, on their chain, through NEAR Intents. Amount on the stage, a coin-and-chain
// grid with real marks, their address, a live quote of what arrives; a review paper from the committed quote; hold to
// send (one gas-free transfer); steps to delivery; a receipt with both transactions. Separate from its logic so
// /dev/flows can show every state.
import { ArrowLeft, Clock3, ExternalLink, KeyRound, ScanLine, Undo2 } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import type { ReactNode } from "react"

import { shortAccount } from "@/components/books/movement-mark"
import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { txUrl } from "@/components/kit/account-link"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { SandboxPill } from "@/components/kit/sandbox-pill"
import { Paper, Stage } from "@/components/kit/stage"
import { ErrorState, TextShimmer } from "@/components/kit/states"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark } from "@/components/marks/mark"
import { RoutePicker } from "@/components/pay/route-picker"
import { ReceiptSlip, SlipRow } from "@/components/receipt/receipt-slip"
import type { PayoutPreview, PayoutView } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { coinAmount, usd } from "@/lib/fiat"
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
  /** The Sandbox: the same form, with the reason it runs in Live instead of a quote (R5). */
  sandbox?: boolean
  /** Open the QR scanner for the address. */
  onScan?: () => void
  onReview: () => void
  onApprove: () => void
  onEdit: () => void
  onAgain: () => void
  onReceive: () => void
}

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
              if (!empty && !p.sandbox) p.onReview()
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
                    {over ? "More than your " : "You have "}
                    {usd(p.balance)}
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
              <RoutePicker routes={p.routes} value={p.routeId} onChange={p.onRoute} />
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
                  <Mark id="intents" size={14} />{" "}
                  {p.sandbox ? "NEAR Intents" : "Live quote from NEAR Intents"}
                </span>
              </span>
              {p.sandbox ? (
                <SandboxPill className="mt-1">Live only · NEAR Intents has no testnet</SandboxPill>
              ) : value <= 0 ? (
                <span className="text-[17px] font-semibold text-text-3">Enter an amount</span>
              ) : !addressOk ? (
                <span className="text-[17px] font-semibold text-text-3">
                  Enter their address to see what arrives
                </span>
              ) : p.preview.data ? (
                <span className="flex items-center justify-between gap-3">
                  <span className="tnum inline-flex items-center gap-2 text-[20px] font-semibold">
                    <Mark id={route.coin} chain={route.chainMark} size={22} />
                    {coinAmount(p.preview.data.amountOutFormatted, route.symbol)}
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

            {p.sandbox ? (
              <Button type="button" disabled>
                Runs in Live
              </Button>
            ) : empty ? (
              <Button type="button" variant="shu" cue="tap" onClick={p.onReceive}>
                Add dollars first
              </Button>
            ) : (
              <Button
                type="submit"
                busy={p.busy}
                disabled={value <= 0 || over || !addressOk || !p.preview.data}
              >
                {value > 0 ? `Review ${usd(value)}` : "Enter an amount"}
              </Button>
            )}
          </motion.form>
        ) : p.step === "review" && p.payout ? (
          <motion.div key="review" className="flex flex-col gap-5" {...slide}>
            <Stage className="p-4 sm:p-6">
              <Paper className="flex flex-col gap-1 p-6">
                <span className="text-detail font-medium text-paper-text-2">You send exactly</span>
                <Figure value={value} className="text-[64px]" />
                <div className="mt-4 flex flex-col divide-y divide-paper-rule text-[15px]">
                  <Row label="To">
                    <span className="inline-flex items-center gap-2 font-mono font-medium">
                      <Mark id={route.chainMark} size={18} /> {shortAccount(p.payout.recipient)}
                    </span>
                  </Row>
                  <Row label="They receive">
                    <span className="tnum inline-flex items-center gap-1.5 font-semibold">
                      <Mark id={route.coin} chain={route.chainMark} size={18} /> about{" "}
                      {coinAmount(p.payout.amountOutFormatted ?? Number.NaN, route.symbol)}
                    </span>
                  </Row>
                  <Row label="Arrives">
                    <span className="font-semibold">
                      {p.payout.timeEstimate ? eta(p.payout.timeEstimate) : "In minutes"}, on{" "}
                      {route.chain}
                    </span>
                  </Row>
                  <Row label="Converted by">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Mark id="intents" size={18} /> NEAR Intents
                    </span>
                  </Row>
                  <Row label="Network fee">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <TegataSeal size={18} textured={false} /> Paid by Tegata
                    </span>
                  </Row>
                </div>
              </Paper>
            </Stage>
            {p.problem ? <p className="text-[15px] font-medium text-down">{p.problem}</p> : null}
            <HoldButton
              label={`Hold to send ${usd(value)}`}
              busy={p.busy}
              onConfirm={p.onApprove}
            />
          </motion.div>
        ) : p.step === "sending" ? (
          <motion.div key="sending" className="flex flex-col gap-5" {...slide}>
            <Stage className="p-4 sm:p-6">
              <Paper className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="inline-flex items-center gap-1.5 text-detail font-medium text-paper-text-2">
                    Sending to <Mark id={route.chainMark} size={16} />{" "}
                    <span className="font-mono">{shortAccount(p.payout?.recipient ?? p.to)}</span>
                  </span>
                  <Figure value={value} className="text-[56px]" />
                </div>
                <TaskSteps steps={steps} current={p.progress} tone="paper" />
              </Paper>
            </Stage>
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
              <p className="inline-flex items-center gap-1.5 text-[15px] text-muted-foreground">
                <Mark id="usdc" chain="near" size={18} /> {usd(value)} is back in your balance.
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
      <span className="text-paper-text-2">{label}</span>
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
    <Stage className="p-4 sm:p-6" inner="flex flex-col items-center gap-4">
      <ReceiptSlip
        className="w-full"
        label="Receipt · Delivered"
        amount={value}
        sub={
          <>
            <Mark id={route.chainMark} size={18} />
            <span className="font-mono">{shortAccount(payout.recipient)}</span>
          </>
        }
        seal={
          <SealPress
            delay={0.2}
            onLanded={() => fire("filled", { cue: "sent", identity: payout.id })}
          >
            <BusinessSeal name={businessName} band="Sent" size={96} />
          </SealPress>
        }
      >
        <SlipRow label="Route">
          <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
            <Mark id="usdc" chain="near" size={16} /> USDC on NEAR
            <span aria-hidden className="text-paper-text-3">
              →
            </span>
            <Mark id={route.coin} chain={route.chainMark} size={16} /> {route.symbol} on{" "}
            {route.chain}
          </span>
        </SlipRow>
        <SlipRow label="Quoted to arrive">
          <span className="tnum">
            {coinAmount(payout.amountOutFormatted ?? Number.NaN, route.symbol)}
          </span>
        </SlipRow>
        <SlipRow label="Converted by">
          <span className="inline-flex items-center gap-1.5">
            <Mark id="intents" size={16} /> NEAR Intents
          </span>
        </SlipRow>
        <SlipRow label="From">{businessName}</SlipRow>
        <SlipRow label="Delivered">{when}</SlipRow>
        <SlipRow label="Network fee">Paid by Tegata</SlipRow>
      </ReceiptSlip>
      {payout.txHash || destination ? (
        <div className="flex flex-wrap justify-center gap-2">
          {payout.txHash ? (
            <a
              href={txUrl(payout.txHash, "mainnet")}
              target="_blank"
              rel="noreferrer"
              className={SLIP_LINK}
            >
              <Mark id="near" size={18} /> On NEAR <ExternalLink />
            </a>
          ) : null}
          {destination ? (
            <a href={destination} target="_blank" rel="noreferrer" className={SLIP_LINK}>
              <Mark id={route.chainMark} size={18} /> On {route.chain} <ExternalLink />
            </a>
          ) : null}
        </div>
      ) : null}
    </Stage>
  )
}

/** A white link pill under the slip, on the stage. */
const SLIP_LINK =
  "press inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold text-black shadow-object [&_svg]:size-4"
