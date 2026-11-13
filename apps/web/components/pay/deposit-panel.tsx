"use client"

// A Live payment from another chain, in flight (plan 6.8 AB): exactly what to send, where, a QR in the chain's own
// payment link (or the plain address where no standard exists), the payer's window, and the steps 1Click reports.
// "Paid" still comes from NEAR: the page moves on when the server has read the USDC delivery.
import { Check, Copy, KeyRound, RefreshCw, Repeat2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useState } from "react"

import { TaskSteps } from "@/components/kit/task-steps"
import type { AttemptView } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

type OneClick = NonNullable<AttemptView["oneclick"]>

/** 1Click's status → the step in flight. */
function stepOf(status: string | null): number {
  if (status === "SUCCESS") return 3
  if (status === "PROCESSING") return 2
  if (status === "KNOWN_DEPOSIT_TX" || status === "INCOMPLETE_DEPOSIT") return 1
  return 0
}

function useCountdown(deadline: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!deadline) return null
  const left = Math.max(0, new Date(deadline).getTime() - now)
  const m = Math.floor(left / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  return { left, text: `${m}:${s.toString().padStart(2, "0")}` }
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
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
        <span
          className={
            mono ? "break-all font-mono text-[14px] font-medium" : "tnum text-[20px] font-semibold"
          }
        >
          {value}
        </span>
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card [&_svg]:size-4">
        {copied ? <Check /> : <Copy />}
      </span>
    </button>
  )
}

export function DepositPanel({ oneclick, business }: { oneclick: OneClick; business: string }) {
  const countdown = useCountdown(oneclick.deadline)
  const step = stepOf(oneclick.swapStatus)
  const chain = oneclick.chain ?? "their chain"
  const steps = [
    { id: "deposit", label: "Waiting for your deposit", detail: `on ${chain}`, icon: <KeyRound /> },
    { id: "seen", label: `Seen on ${chain}`, detail: "your transaction arrived", icon: <Check /> },
    {
      id: "convert",
      label: "Converting on NEAR Intents",
      detail: "to USDC on NEAR",
      mark: "intents" as const,
    },
    {
      id: "near",
      label: "Paid on NEAR",
      detail: `${business} receives the exact amount`,
      mark: "near" as const,
    },
  ]
  const until = oneclick.deadline
    ? new Date(oneclick.deadline).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null
  const amount = `${oneclick.amountInFormatted ?? "…"} ${oneclick.symbol ?? ""}`.trim()
  return (
    <div className="flex flex-col gap-4">
      {step === 0 && oneclick.depositAddress ? (
        <div className="flex flex-col gap-3 rounded-[20px] bg-card p-4 shadow-[0_0_0_1px_var(--border)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">Send exactly</span>
            {countdown ? (
              <span
                className={`tnum rounded-full px-3 py-1 text-[13px] font-semibold ${countdown.left < 120_000 ? "bg-warn-surface text-warn" : "bg-secondary"}`}
              >
                {countdown.left > 0 ? `Pay within ${countdown.text}` : "Time's up"}
              </span>
            ) : null}
          </div>
          <CopyRow label={`${oneclick.symbol ?? ""} on ${chain}`} value={amount} />
          <CopyRow label="To this address" value={oneclick.depositAddress} mono />
          {oneclick.depositMemo ? (
            <CopyRow label="With this memo" value={oneclick.depositMemo} mono />
          ) : null}
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="rounded-[20px] bg-white p-3">
              <QRCodeSVG
                value={oneclick.payUri ?? oneclick.depositAddress}
                size={200}
                level="M"
                imageSettings={{ src: "/icon.svg", height: 40, width: 40, excavate: true }}
              />
            </div>
            <span className="text-center text-detail text-muted-foreground">
              {oneclick.payUri
                ? "Scan with your wallet: the amount is filled in."
                : "Scan the address, then enter the amount above."}
            </span>
          </div>
        </div>
      ) : null}
      {oneclick.swapStatus === "INCOMPLETE_DEPOSIT" ? (
        <p className="flex items-start gap-2 rounded-[14px] bg-warn-surface px-4 py-3 text-[14px] font-medium text-warn">
          <Repeat2 className="mt-0.5 size-4 shrink-0" />
          Less than {amount} arrived. Send the rest to the same address
          {until ? ` before ${until}` : ""}, or it's refunded.
        </p>
      ) : null}
      <div className="rounded-[20px] bg-secondary p-2">
        <TaskSteps steps={steps} current={step} />
      </div>
      <p className="flex items-start gap-2 px-1 text-detail text-muted-foreground">
        <RefreshCw className="mt-0.5 size-3.5 shrink-0" />
        If anything goes wrong, it's refunded to {oneclick.refundTo ?? "your address"} on {chain}.
      </p>
    </div>
  )
}
