"use client"

// Add money (plan 6.8 W and C): one chooser instead of a row of stage actions. Your pay address (its QR), from a coin
// on another chain through NEAR Intents (Live; the Sandbox shows it with the reason, R5), and test dollars in the
// Sandbox. Each row leads with the real mark of where the money comes from.
import { ArrowLeft, Check, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"

import {
  FROM_CHAIN_MARKS,
  FromChainForm,
  type FromChainProps,
} from "@/components/books/add-from-chain-sheet"
import { shortAccount } from "@/components/books/movement-mark"
import { TegataSeal } from "@/components/brand/seal"
import { Spinner } from "@/components/kit/button"
import { SandboxPill } from "@/components/kit/sandbox-pill"
import { Mark, MarkStack } from "@/components/marks/mark"
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
}) {
  const [step, setStep] = useState<"choose" | "chain">("choose")
  useEffect(() => {
    if (!open) setStep("choose")
  }, [open])
  const grant = testDollars?.state ?? "idle"

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={step === "chain" ? "Add from another chain" : "Add money"}
    >
      {step === "chain" ? (
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
