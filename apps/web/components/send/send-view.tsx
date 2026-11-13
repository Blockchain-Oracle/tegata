"use client"

import type { NetworkId } from "@tegata/config"
// Send (Kawase's money lifecycle): one big amount and a NEAR name; a review card that says the fee is paid
// by Tegata; hold to send (the Privy key signs underneath); live steps; a receipt slip that lands when NEAR settles,
// or a failure card that says no money moved. Separate from its logic so /dev/flows can show every state.
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  KeyRound,
  Radio,
  ReceiptText,
  ScanLine,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { shortAccount } from "@/components/books/movement-mark"
import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { CustomerDisc } from "@/components/invoices/customer-picker"
import { AccountLink } from "@/components/kit/account-link"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Paper, Stage } from "@/components/kit/stage"
import { ErrorState } from "@/components/kit/states"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark } from "@/components/marks/mark"
import { ReceiptSlip, SlipRow } from "@/components/receipt/receipt-slip"
import { fire } from "@/lib/feedback"
import { usd } from "@/lib/fiat"
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
  /** The network sent on, for the explorer link of an implicit (64-hex) account. */
  network?: NetworkId
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
  /** Your team's ready people: one tap fills "To" with the account their pay lands in. */
  team?: { id: string; name: string; accountId: string }[]
  /** Shown under the title on the form, in Live: NEAR account / Another chain. */
  switcher?: React.ReactNode
  /** Open the QR scanner for "To". */
  onScan?: () => void
  /** A notice above the form (e.g. a scanned address that needs Live). */
  notice?: string | null
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
      {p.step === "form" ? p.switcher : null}
      {p.step === "form" && p.notice ? (
        <p className="rounded-[14px] bg-warn-surface px-4 py-3 text-[14px] font-medium text-warn">
          {p.notice}
        </p>
      ) : null}

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
              status={p.problem ? { kind: "bad", text: p.problem } : { kind: "none" }}
            />
            {p.team?.length ? (
              <div className="-mt-2 flex flex-wrap items-center gap-2">
                <span className="text-detail text-muted-foreground">Your team</span>
                {p.team.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => p.onTo(member.accountId)}
                    className={cn(
                      "press inline-flex h-9 items-center gap-2 rounded-full pr-3 pl-1 text-[14px] font-semibold",
                      p.to === member.accountId
                        ? "bg-shu text-black"
                        : "bg-secondary hover:bg-plate-pressed",
                    )}
                  >
                    <CustomerDisc name={member.name} size={28} />
                    {member.name}
                  </button>
                ))}
              </div>
            ) : null}
            {empty ? (
              <Button type="button" variant="shu" cue="tap" onClick={p.onReceive}>
                Add dollars first <ArrowRight />
              </Button>
            ) : (
              <Button type="submit" busy={p.busy} disabled={!p.to || value <= 0 || over}>
                {value > 0 ? `Review ${usd(value)}` : "Enter an amount"}
              </Button>
            )}
          </motion.form>
        ) : p.step === "review" ? (
          <motion.div key="review" className="flex flex-col gap-5" {...slide}>
            <Stage className="p-4 sm:p-6">
              <Paper className="flex flex-col gap-1 p-6">
                <span className="text-detail font-medium text-paper-text-2">You send</span>
                <Figure value={value} className="text-[64px]" />
                <div className="mt-4 flex flex-col divide-y divide-paper-rule text-[15px]">
                  <Row label="To">
                    <span className="inline-flex items-center gap-2 font-mono font-medium">
                      <Mark id="near" size={18} />{" "}
                      <AccountLink accountId={p.to} network={p.network} />
                    </span>
                  </Row>
                  <Row label="They receive">
                    <span className="tnum inline-flex items-center gap-1.5 font-semibold">
                      <Mark id="usdc" chain="near" size={18} /> {usd(value)}
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
                    Sending to <Mark id="near" size={16} />
                    <span className="font-mono">{shortAccount(p.to)}</span>
                  </span>
                  <Figure value={value} className="text-[56px]" />
                </div>
                <TaskSteps steps={STEPS} current={p.progress} tone="paper" />
              </Paper>
            </Stage>
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
      <span className="text-paper-text-2">{label}</span>
      {children}
    </div>
  )
}

/** The receipt slip (the one slip) on the stage: the business seal pressed once with the "sent" cue. */
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
    <Stage className="p-4 sm:p-6" inner="flex flex-col items-center gap-4">
      <ReceiptSlip
        className="w-full"
        label="Receipt · Sent"
        amount={value}
        sub={
          <>
            <Mark id="near" size={18} />
            <span className="font-mono">{shortAccount(to)}</span>
          </>
        }
        seal={
          <SealPress
            delay={0.2}
            onLanded={() => fire("filled", { cue: "sent", identity: relayId ?? undefined })}
          >
            <BusinessSeal name={businessName} band="Sent" size={96} />
          </SealPress>
        }
      >
        <SlipRow label="From">{businessName}</SlipRow>
        <SlipRow label="Settled">{now}</SlipRow>
        <SlipRow label="Network fee">
          <span className="inline-flex items-center gap-1.5">
            <TegataSeal size={16} textured={false} /> Paid by Tegata
          </span>
        </SlipRow>
      </ReceiptSlip>
      {relayId || explorerUrl ? (
        <div className="flex flex-wrap justify-center gap-2">
          {relayId ? (
            <Link href={`/r/send/${relayId}`} className={SLIP_LINK}>
              <ReceiptText /> Open receipt
            </Link>
          ) : null}
          {explorerUrl ? (
            <a href={explorerUrl} target="_blank" rel="noreferrer" className={SLIP_LINK}>
              <Mark id="near" size={18} /> On NEAR <ExternalLink />
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
