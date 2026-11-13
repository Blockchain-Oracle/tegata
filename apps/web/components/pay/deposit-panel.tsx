"use client"

// A Live payment from another chain, in flight: exactly what to send (with the coin's own mark), where
// (grouped in fours, copied whole), a QR in the chain's own payment link (or the plain address where no standard
// exists), the payer's window, and the steps 1Click reports, each with its chain's mark. "Paid" still comes from
// NEAR: the page moves on when the server has read the USDC delivery.
import { Check, Copy, ExternalLink, RefreshCw, Repeat2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useState } from "react"

import { Paper, Stage } from "@/components/kit/stage"
import { type TaskStep, TaskSteps } from "@/components/kit/task-steps"
import { MARKS, Mark, type MarkId } from "@/components/marks/mark"
import { PAY_WALLET_KEY, useChainWallets, WalletIcon } from "@/components/pay/wallet-rows"
import type { AttemptView } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { groupNumber } from "@/lib/fiat"
import { chainTxUrl, routeOfAsset } from "@/lib/routes"
import { cn } from "@/lib/utils"

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

/**
 * The exact amount to send, grouped but never rounded: rounding down would leave the deposit short. "1251.387" →
 * "1,251.387".
 */
function exactAmount(formatted: string): string {
  const [whole = "0", fraction] = formatted.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return fraction ? `${grouped}.${fraction}` : grouped
}

/** "T9yD…3kPq": an address short enough for one line. */
const shortAddress = (value: string) =>
  value.length > 14 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value

const isMark = (id: string | null | undefined): id is MarkId => Boolean(id && id in MARKS)

function CopyRow({
  label,
  value,
  shown,
  art,
  mono,
}: {
  label: string
  /** What's copied. */
  value: string
  /** What's drawn, when it differs (grouped). */
  shown?: string
  art?: React.ReactNode
  mono?: boolean
}) {
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
      {art}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-detail text-muted-foreground">{label}</span>
        <span
          className={mono ? "font-mono text-[14px] font-medium" : "tnum text-[20px] font-semibold"}
        >
          {shown ?? value}
        </span>
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card [&_svg]:size-4">
        {copied ? <Check /> : <Copy />}
      </span>
    </button>
  )
}

export function DepositPanel({
  oneclick,
  business,
  attemptId,
}: {
  oneclick: OneClick
  business: string
  /** The payment, so a wallet's transaction can be handed to NEAR Intents. */
  attemptId?: string
}) {
  const countdown = useCountdown(oneclick.deadline)
  const step = stepOf(oneclick.swapStatus)
  const route = routeOfAsset(oneclick.assetIn)
  const chain = oneclick.chain ?? route?.chain ?? "their chain"
  const symbol = oneclick.symbol ?? route?.symbol ?? ""
  const coin = oneclick.coin ?? route?.coin ?? null
  const chainMark = oneclick.chainMark ?? route?.chainMark ?? null
  // The coin you send, then the chain it lands on, then NEAR Intents, then NEAR: each step with its real mark.
  const coinArt = isMark(coin) ? { mark: coin } : isMark(chainMark) ? { mark: chainMark } : {}
  const chainArt = isMark(chainMark) ? { mark: chainMark } : {}
  const steps: TaskStep[] = [
    { id: "deposit", label: `Waiting for your ${symbol || "deposit"}`, ...coinArt },
    { id: "seen", label: `Seen on ${chain}`, ...chainArt },
    { id: "convert", label: "Converting on NEAR Intents", mark: "intents" },
    { id: "near", label: `Paid to ${business} on NEAR`, mark: "near" },
  ]
  const until = oneclick.deadline
    ? new Date(oneclick.deadline).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null
  const exact = oneclick.amountInFormatted ? exactAmount(oneclick.amountInFormatted) : "…"
  const amount = `${exact} ${symbol}`.trim()
  return (
    <div className="flex flex-col gap-4">
      {step === 0 && oneclick.depositAddress ? (
        <div className="flex flex-col gap-3 rounded-[20px] bg-card p-4 shadow-[0_0_0_1px_var(--border)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">Send exactly</span>
            {countdown ? (
              <span
                className={cn(
                  "tnum rounded-full px-3 py-1 text-[13px] font-semibold",
                  countdown.left < 120_000 ? "bg-warn-surface text-warn" : "bg-secondary",
                )}
              >
                {countdown.left > 0 ? `Pay within ${countdown.text}` : "Time's up"}
              </span>
            ) : null}
          </div>
          {chainMark && oneclick.amountIn ? (
            <WalletSend
              chainMark={chainMark}
              contract={oneclick.tokenContract ?? null}
              to={oneclick.depositAddress}
              amount={oneclick.amountIn}
              shown={amount}
              attemptId={attemptId}
            />
          ) : null}
          <CopyRow
            label={`${symbol} on ${chain}`}
            value={oneclick.amountInFormatted ?? ""}
            shown={amount}
            art={coin ? <Mark id={coin} chain={chainMark ?? undefined} size={28} /> : undefined}
          />
          <CopyRow
            label="To this address"
            value={oneclick.depositAddress}
            shown={groupNumber(oneclick.depositAddress)}
            mono
          />
          {oneclick.depositMemo ? (
            <CopyRow
              label="With this memo"
              value={oneclick.depositMemo}
              shown={groupNumber(oneclick.depositMemo)}
              mono
            />
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
              {oneclick.payUri ? "Amount filled in" : "Address only · type the amount"}
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
      <Stage className="p-3 sm:p-4" grid={false}>
        <Paper className="p-2">
          <TaskSteps steps={steps} current={step} tone="paper" />
        </Paper>
      </Stage>
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-card px-4 py-3 text-[14px]">
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="size-4" /> Refunds to
        </span>
        <span
          className="inline-flex min-w-0 items-center gap-1.5 font-mono font-medium"
          title={oneclick.refundTo ?? undefined}
        >
          {isMark(chainMark) ? <Mark id={chainMark} size={16} /> : null}
          {oneclick.refundTo ? shortAddress(oneclick.refundTo) : "your address"}
        </span>
      </div>
    </div>
  )
}

/**
 * "Send 25.0026 USDC with MetaMask": the payer's own wallet sends exactly the quote's amount to the deposit address
 * (switching to the chain first if it has to). The transaction goes to NEAR Intents as a hint; "paid" still comes from
 * the USDC arriving on NEAR. Shown only when a wallet for this chain is on the device.
 */
function WalletSend({
  chainMark,
  contract,
  to,
  amount,
  shown,
  attemptId,
}: {
  chainMark: string
  contract: string | null
  to: string
  amount: string
  shown: string
  attemptId?: string
}) {
  const wallets = useChainWallets(chainMark)
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent"; hash: string }
    | { kind: "problem"; text: string }
  >({ kind: "idle" })
  if (!wallets?.length) return null
  const chosen = (() => {
    try {
      return sessionStorage.getItem(PAY_WALLET_KEY)
    } catch {
      return null
    }
  })()
  const wallet = wallets.find((w) => w.id === chosen) ?? wallets[0]
  if (!wallet) return null

  if (state.kind === "sent") {
    const url = chainTxUrl(chainMark, state.hash)
    return (
      <div className="flex items-center gap-3 rounded-[14px] bg-up-surface px-4 py-3 text-[15px] font-semibold text-up">
        <Check className="size-4 shrink-0" />
        <span className="flex-1">Sent from {wallet.name}</span>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[13px] underline-offset-2 hover:underline"
          >
            View it <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    )
  }

  const send = async () => {
    setState({ kind: "sending" })
    try {
      const { sendFromWallet, WalletRejected } = await import("@/lib/client/chain-wallets")
      try {
        const hash = await sendFromWallet(wallet, {
          chainMark,
          contract,
          to,
          amount: BigInt(amount),
        })
        fire("confirm", { cue: "sent" })
        setState({ kind: "sent", hash })
        if (attemptId)
          void fetch(`/api/pay/attempts/${attemptId}/deposit-tx`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ txHash: hash }),
          }).catch(() => undefined)
      } catch (error) {
        fire("fail", { cue: "error" })
        setState({
          kind: "problem",
          text:
            error instanceof WalletRejected
              ? "Nothing was sent. Try again, or send it another way below."
              : error instanceof Error
                ? error.message
                : "The wallet didn't send it. Nothing moved.",
        })
      }
    } catch {
      setState({ kind: "problem", text: "Couldn't reach the wallet. Send it another way below." })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void send()}
        disabled={state.kind === "sending"}
        className="press flex h-14 items-center justify-center gap-3 rounded-[14px] bg-primary px-4 text-[16px] font-semibold text-primary-foreground disabled:opacity-60"
      >
        {state.kind === "sending" ? (
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <WalletIcon wallet={wallet} size={24} />
        )}
        {state.kind === "sending"
          ? `Approve in ${wallet.name}`
          : `Send ${shown} with ${wallet.name}`}
      </button>
      {state.kind === "problem" ? (
        <p className="text-[14px] font-medium text-down">{state.text}</p>
      ) : null}
      <span className="text-center text-detail text-muted-foreground">or send it yourself</span>
    </div>
  )
}
