"use client"

// Add money (C and AD job 2): one chooser instead of a row of stage actions. Your pay address (its QR), a
// bank card through Transak, a coin on another chain through NEAR Intents (Live; the Sandbox shows it with the reason,
// R5), and test dollars in the Sandbox. Each row leads with the real mark of where the money comes from.
import { ArrowLeft, Check, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"

import {
  FROM_CHAIN_MARKS,
  FromChainForm,
  type FromChainProps,
} from "@/components/books/add-from-chain-sheet"
import { shortAccount } from "@/components/books/movement-mark"
import { TegataSeal } from "@/components/brand/seal"
import { Button, Spinner } from "@/components/kit/button"
import { SandboxPill } from "@/components/kit/sandbox-pill"
import { Mark, MarkStack } from "@/components/marks/mark"
import { CardNetworksMark } from "@/components/marks/paid-with"
import { Sheet } from "@/components/shell/sheet"
import type { TestDollars } from "@/hooks/use-test-dollars"
import { cn } from "@/lib/utils"

export function AddMoneySheet({
  open,
  onOpenChange,
  live,
  accountId,
  onPayAddress,
  testDollars,
  onTestDollars,
  chain,
  card,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Live: adding from another chain runs; the Sandbox shows it with the reason. */
  live: boolean
  accountId: string
  /** Open the pay address and its QR. */
  onPayAddress: () => void
  /** Sandbox only. */
  testDollars?: TestDollars
  onTestDollars?: () => void
  chain: FromChainProps
  /** With a card (Transak): open when this network takes cards. */
  card?: FromChainProps & { open: boolean; reason?: string }
}) {
  const [step, setStep] = useState<"choose" | "chain" | "card">("choose")
  useEffect(() => {
    if (!open) setStep("choose")
  }, [open])
  const grant = testDollars?.state ?? "idle"

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        step === "chain"
          ? "Add from another chain"
          : step === "card"
            ? "Add with a card"
            : "Add money"
      }
    >
      {step === "card" && card ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setStep("choose")}
            className="press inline-flex items-center gap-1.5 self-start text-[14px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Other ways
          </button>
          <CardTopUpForm {...card} />
        </div>
      ) : step === "chain" ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setStep("choose")}
            className="press inline-flex items-center gap-1.5 self-start text-[14px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Other ways
          </button>
          <FromChainForm {...chain} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Option
            mark={<Mark id="usdc" chain="near" size={40} />}
            title="To your pay address"
            detail={<span className="font-mono">{shortAccount(accountId)}</span>}
            onClick={() => {
              onOpenChange(false)
              onPayAddress()
            }}
          />
          {card ? (
            <Option
              mark={<CardNetworksMark size={40} />}
              title="With a card"
              detail={
                card.open ? "Visa, Mastercard · fee shown first" : (card.reason ?? "Opening soon")
              }
              disabled={!card.open}
              onClick={() => setStep("card")}
            />
          ) : null}
          <Option
            mark={<Mark id="intents" size={40} />}
            title="From another chain"
            detail={<MarkStack ids={FROM_CHAIN_MARKS} size={18} />}
            disabled={!live}
            trailing={live ? undefined : <SandboxPill>Live only</SandboxPill>}
            onClick={() => setStep("chain")}
          />
          {onTestDollars ? (
            <Option
              mark={
                <span className="grid size-10 place-items-center rounded-full bg-kin">
                  <TegataSeal size={24} textured={false} tilt={0} />
                </span>
              }
              title={grant === "sent" ? "Test dollars added" : "Test dollars"}
              detail={
                grant === "sending"
                  ? "Sending $5.00…"
                  : grant === "sent"
                    ? "$5.00 is in your balance"
                    : grant === "failed"
                      ? (testDollars?.error ?? "That didn't work. Try again.")
                      : "$5.00 of test USDC, once a day"
              }
              disabled={grant === "sending" || grant === "sent"}
              trailing={
                grant === "sending" ? (
                  <Spinner />
                ) : grant === "sent" ? (
                  <Check className="size-5 text-up" />
                ) : undefined
              }
              onClick={onTestDollars}
            />
          ) : null}
        </div>
      )}
    </Sheet>
  )
}

/** How much to add with a card; the card checkout (Transak, locked to your own account) opens next. */
function CardTopUpForm({ busy, problem, onContinue }: FromChainProps) {
  const [amount, setAmount] = useState("100")
  const value = Number.parseFloat(amount || "0") || 0
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (value > 0) onContinue(amount)
      }}
    >
      <label className="flex items-baseline justify-center rounded-[20px] bg-secondary py-6">
        <span className="sr-only">Dollars to add</span>
        <span className={cn("figure text-[44px]", value > 0 ? "" : "text-text-3")}>$</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) =>
            setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
          }
          size={Math.max(1, amount.length || 1)}
          className="figure min-w-[1ch] bg-transparent text-center text-[56px] outline-none"
        />
      </label>
      <div className="flex justify-center gap-2">
        {["100", "250", "500"].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(v)}
            aria-pressed={amount === v}
            className={cn(
              "press rounded-full px-4 py-2 text-[15px] font-semibold",
              amount === v ? "bg-foreground text-background" : "bg-secondary",
            )}
          >
            ${v}
          </button>
        ))}
      </div>
      <p className="text-center text-[14px] text-muted-foreground">
        Lands in your balance as USDC on NEAR in about 2 minutes.
      </p>
      {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
      <Button type="submit" busy={busy} disabled={value <= 0}>
        Continue to Transak
      </Button>
    </form>
  )
}

function Option({
  mark,
  title,
  detail,
  trailing,
  disabled,
  onClick,
}: {
  mark: React.ReactNode
  title: string
  detail: React.ReactNode
  trailing?: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "press flex items-center gap-3 rounded-[16px] bg-secondary p-3 text-left hover:bg-plate-pressed",
        "disabled:cursor-default disabled:hover:bg-secondary disabled:active:scale-100",
      )}
    >
      {mark}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[16px] font-semibold">{title}</span>
        <span className="truncate text-detail text-muted-foreground">{detail}</span>
      </span>
      {trailing ?? <ChevronRight className="size-4 shrink-0 text-text-3" />}
    </button>
  )
}
