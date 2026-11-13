"use client"

// Add money from another chain (Live): how much, then the pay page's "another chain" option for the
// business's own account: pick the coin and chain you hold, send it to the deposit address, and NEAR Intents delivers
// USDC to your balance on NEAR. The form is also the "From another chain" step of the Add money chooser.
import { ArrowRight } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { MarkStack } from "@/components/marks/mark"
import { Sheet } from "@/components/shell/sheet"

export interface FromChainProps {
  busy: boolean
  problem: string | null
  onContinue: (amount: string) => void
}

/** The coins a payer can add from; the stack carries them, not a sentence. */
export const FROM_CHAIN_MARKS = ["usdt", "usdc", "eth", "btc", "sol", "tron", "base"] as const

export function FromChainForm({ busy, problem, onContinue }: FromChainProps) {
  const [amount, setAmount] = useState("")
  const value = Number.parseFloat(amount || "0") || 0
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (value > 0) onContinue(amount)
      }}
    >
      <div className="flex items-center justify-between gap-3 rounded-[16px] bg-secondary px-4 py-3">
        <span className="text-[15px] font-semibold">From any of these</span>
        <MarkStack ids={FROM_CHAIN_MARKS} size={24} />
      </div>
      <Field
        id="topup-amount"
        label="Dollars to add"
        inputMode="decimal"
        placeholder="50.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        leading={<span className="text-[17px] font-semibold text-text-3">$</span>}
        status={problem ? { kind: "bad", text: problem } : { kind: "none" }}
      />
      <Button type="submit" busy={busy} disabled={value <= 0} cue="tap">
        Choose a coin and chain <ArrowRight />
      </Button>
    </form>
  )
}

export function AddFromChainSheet({
  open,
  onOpenChange,
  ...form
}: FromChainProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add from another chain">
      <FromChainForm {...form} />
    </Sheet>
  )
}
