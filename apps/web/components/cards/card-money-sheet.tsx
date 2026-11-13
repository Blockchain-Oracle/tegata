"use client"

// Add money and Move back: one mirrored sheet. Adding is one gas-free transfer from the balance,
// held to approve; moving back needs no signature (Tegata's card reserve returns it), so it's a plain button.
import { ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/kit/button"
import { HoldButton } from "@/components/kit/hold-button"
import { Stage } from "@/components/kit/stage"
import { Mark } from "@/components/marks/mark"
import { Sheet } from "@/components/shell/sheet"
import type { IssuedCardView } from "@/lib/client/types"
import { usd, usdUnits } from "@/lib/fiat"
import { cn } from "@/lib/utils"

import { CardFace } from "./card-face"

export function CardMoneySheet({
  open,
  onOpenChange,
  direction,
  card,
  business,
  balance,
  busy,
  problem,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  direction: "in" | "out"
  card: IssuedCardView | null
  business: string
  /** Dollars in the balance. */
  balance: number
  busy: boolean
  problem: string | null
  onConfirm: (amount: string) => void
}) {
  const [amount, setAmount] = useState("")
  useEffect(() => {
    if (open) setAmount("")
  }, [open])
  if (!card) return null
  const onCard = Number(BigInt(card.onCard)) / 1_000_000
  const value = Number.parseFloat(amount || "0") || 0
  const max = direction === "in" ? balance : onCard
  const over = value > max
  const ready = value > 0 && !over && (direction === "out" || value >= 2)
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={direction === "in" ? "Add money" : "Move back"}
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready && direction === "out") onConfirm(amount)
        }}
      >
        <Stage className="px-5 py-6" inner="flex flex-col items-center gap-3">
          <span className="flex items-center gap-2 text-[14px] font-medium text-white/90">
            {direction === "in" ? (
              <>
                <Mark id="usdc" size={18} /> Your balance{" "}
                <ArrowDownLeft className="size-4 rotate-180" />
                {card.nickname}
              </>
            ) : (
              <>
                {card.nickname} <ArrowUpRight className="size-4" /> <Mark id="usdc" size={18} />{" "}
                Your balance
              </>
            )}
          </span>
          <span className="flex items-baseline">
            <span className={cn("figure text-[52px]", value > 0 ? "text-white" : "text-white/55")}>
              $
            </span>
            <input
              aria-label="Amount"
              inputMode="decimal"
              placeholder="0"
              autoComplete="off"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
              }
              size={Math.max(1, amount.length || 1)}
              className="figure min-w-[1ch] bg-transparent text-center text-[64px] text-white caret-white outline-none placeholder:text-white/55"
            />
          </span>
          <span className="rounded-full bg-white/18 px-3 py-1 text-[13px] text-white">
            {over
              ? `More than ${direction === "in" ? "your balance" : "is on the card"}`
              : direction === "in"
                ? `Balance ${usd(balance)}`
                : `On the card ${usdUnits(card.onCard)}`}
            {" · "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => setAmount(max.toFixed(2))}
            >
              {direction === "in" ? "Use all" : "All of it"}
            </button>
          </span>
        </Stage>
        <div className="flex items-center gap-3 rounded-[16px] bg-secondary p-3">
          <CardFace
            tone={card.tone}
            business={business}
            nickname={card.nickname}
            holder={card.holderName}
            last4={card.last4}
            size="thumb"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold">{card.nickname}</span>
            <span className="text-[13px] text-muted-foreground">
              {direction === "in" && value > 0 && value < 2
                ? "At least $2.00"
                : `Fee paid by Tegata`}
            </span>
          </span>
        </div>
        {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
        {direction === "in" ? (
          <HoldButton
            label={`Hold to add ${usd(value)}`}
            ready={ready}
            busy={busy}
            onConfirm={() => onConfirm(amount)}
          />
        ) : (
          <Button type="submit" busy={busy} disabled={!ready}>
            Move {usd(value)} back
          </Button>
        )}
      </form>
    </Sheet>
  )
}
