"use client"

// Send (plan 6.8, Kawase's money lifecycle): one big amount and a NEAR name; a review card that says the fee is paid
// by Tegata; hold to send (the Privy key signs underneath); live steps; a receipt slip that lands when NEAR settles,
// or a failure card that says no money moved. Separate from its logic so /dev/flows can show every state.
import { ArrowLeft, ArrowRight, ExternalLink, KeyRound, Radio, ReceiptText } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"

import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Paper, Stage } from "@/components/kit/stage"
import { ErrorState } from "@/components/kit/states"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

export type SendStep = "form" | "review" | "sending" | "sent" | "failed"

export interface SendViewProps {
  step: SendStep
  to: string
  onTo: (value: string) => void
  amount: string
  onAmount: (value: string) => void
  /** USDC balance in dollars. */
  balance: number
  businessName: string
  suffix: string
  busy: boolean
  problem: string | null
  /** 0 signing, 1 relaying, 2 settling, 3 settled. */
  progress: number
  explorerUrl: string | null
  relayId: string | null
  onReview: () => void
  onApprove: () => void
  onEdit: () => void
  onReceive: () => void
  onAgain: () => void
}

const STEPS = [
  {
    id: "sign",
    label: "Approved with your key",
    detail: "signed on this device",
    icon: <KeyRound />,
  },
  { id: "relay", label: "Sent by Tegata", detail: "network fee paid by Tegata", icon: <Radio /> },
  { id: "near", label: "Settling on NEAR", detail: "about two seconds", mark: "near" as const },
]

export function SendView(p: SendViewProps) {
  const reduce = useReducedMotion()
  const value = Number.parseFloat(p.amount || "0") || 0
  const over = value > p.balance
  const empty = p.balance <= 0
  const slide = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as const },
  }

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
                <label htmlFor="amount" className="text-[15px] font-medium text-white/85">
                  You send
                </label>
                <div className="flex items-baseline justify-center">
                  <span
                    className={cn("figure text-[56px]", value > 0 ? "text-white" : "text-white/55")}
                  >
                    $
                  </span>
                  <input
                    id="amount"
                    inputMode="decimal"
                    placeholder="0"
                    value={p.amount}
                    onChange={(e) =>
                      p.onAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
                    }
                    size={Math.max(1, p.amount.length || 1)}
                    className="figure min-w-[1ch] bg-transparent text-center text-[80px] text-white caret-white outline-none placeholder:text-white/55 focus-visible:outline-none"
                    // biome-ignore lint/a11y/noAutofocus: the amount is the only thing to type on this screen.
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/18 py-1 pr-1 pl-2.5 text-[14px] text-white">
                  <Mark id="usdc" size={18} />
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
            <Field
              id="to"
              label="To"
              placeholder={`name${p.suffix}`}
              value={p.to}
              onChange={(e) => p.onTo(e.target.value.trim().toLowerCase())}
              spellCheck={false}
              autoCapitalize="none"
              className="font-mono"
              leading={<Mark id="near" size={24} />}
              status={p.problem ? { kind: "bad", text: p.problem } : { kind: "none" }}
            />
            {empty ? (
              <Button type="button" variant="shu" cue="tap" onClick={p.onReceive}>
                Add dollars first <ArrowRight />
              </Button>
            ) : (
              <Button type="submit" busy={p.busy} disabled={!p.to || value <= 0 || over}>
                {value > 0 ? `Review $${value.toFixed(2)}` : "Enter an amount"}
              </Button>
            )}
          </motion.form>
        ) : p.step === "review" ? (
          <motion.div key="review" className="flex flex-col gap-5" {...slide}>
            <Stage className="p-4 sm:p-6">
              <Paper className="flex flex-col gap-1 p-6">
                <span className="text-detail font-medium text-[#666]">You send</span>
                <Figure value={value} className="text-[64px]" />
                <div className="mt-4 flex flex-col divide-y divide-[#ECECEC] text-[15px]">
                  <Row label="To">
                    <span className="inline-flex items-center gap-2 font-mono font-medium">
                      <Mark id="near" size={18} /> {p.to}
                    </span>
                  </Row>
                  <Row label="They receive">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Mark id="usdc" size={18} /> ${value.toFixed(2)} USDC
                    </span>
                  </Row>
                  <Row label="Network fee">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <TegataSeal size={18} textured={false} /> Paid by Tegata
                    </span>
                  </Row>
                  <Row label="Arrives">
                    <span className="font-semibold">In seconds, on NEAR</span>
                  </Row>
                </div>
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
              <span className="text-detail font-medium text-muted-foreground">
                Sending to {p.to}
              </span>
              <Figure value={value} className="text-[56px]" />
            </div>
            <div className="rounded-[20px] bg-secondary p-2">
              <TaskSteps steps={STEPS} current={p.progress} />
            </div>
          </motion.div>
        ) : p.step === "sent" ? (
          <motion.div key="sent" className="flex flex-col gap-5" {...slide}>
            <Receipt
              value={value}
              to={p.to}
              businessName={p.businessName}
              explorerUrl={p.explorerUrl}
              relayId={p.relayId}
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
        ) : (
          <motion.div key="failed" className="flex flex-col gap-5" {...slide}>
            <ErrorState
              title="That payment wasn't sent"
              detail={p.problem ?? "NEAR didn't accept it."}
              stillWorks="No money left your balance."
              onRetry={p.onEdit}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[#666]">{label}</span>
      {children}
    </div>
  )
}

/** The receipt slip: paper, perforation, the business seal pressed once with the "sent" cue. */
function Receipt({
  value,
  to,
  businessName,
  explorerUrl,
  relayId,
}: {
  value: number
  to: string
  businessName: string
  explorerUrl: string | null
  relayId: string | null
}) {
  const now = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
  return (
    <div className="relative rounded-[20px] bg-white text-black shadow-receipt">
      <div className="p-6 pb-4">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-[#666]">
          <TegataSeal size={20} textured={false} /> Receipt · Sent
        </span>
        <Figure value={value} className="mt-3 flex text-[56px]" />
        <div className="mt-2 flex items-center gap-2 text-[15px] font-semibold">
          <Mark id="near" size={22} /> {to}
        </div>
      </div>
      <div className="relative h-4">
        <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-background" />
        <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-background" />
        <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-[#E2E2E2]" />
      </div>
      <div className="flex flex-col gap-2.5 p-6 pt-3 text-[14px]">
        <div className="flex justify-between">
          <span className="text-[#666]">From</span>
          <span className="font-semibold">{businessName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#666]">Settled</span>
          <span className="font-semibold">{now}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#666]">Network fee</span>
          <span className="font-semibold">Paid by Tegata</span>
        </div>
        <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          {relayId ? (
            <Link
              href={`/r/send/${relayId}`}
              className="inline-flex items-center gap-1.5 font-semibold text-[#B23700] hover:underline"
            >
              <ReceiptText className="size-3.5" /> Open receipt
            </Link>
          ) : null}
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-[#B23700] hover:underline"
            >
              See it on NEAR <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </span>
      </div>
      <div className="absolute top-4 right-4">
        <SealPress
          delay={0.2}
          onLanded={() => fire("filled", { cue: "sent", identity: relayId ?? undefined })}
        >
          <BusinessSeal name={businessName} band="Sent" size={96} />
        </SealPress>
      </div>
    </div>
  )
}
