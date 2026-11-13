"use client"

// Add money from another chain (Live, plan 6.8 AB): how much, then the pay page's "another chain" option for the
// business's own account: pick the coin and chain you hold, send it to the deposit address, and NEAR Intents delivers
// USDC to your balance on NEAR.
import { ArrowRight } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { MarkStack } from "@/components/marks/mark"
import { Sheet } from "@/components/shell/sheet"

export function AddFromChainSheet({
  open,
  onOpenChange,
  busy,
  problem,
  onContinue,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  problem: string | null
  onContinue: (amount: string) => void
}) {
  const [amount, setAmount] = useState("")
  const value = Number.parseFloat(amount || "0") || 0
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add from another chain">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (value > 0) onContinue(amount)
        }}
      >
        <div className="flex items-center gap-3 rounded-[16px] bg-secondary p-4">
          <MarkStack ids={["usdt", "eth", "btc", "sol", "tron", "base"]} size={24} />
          <p className="text-[14px] text-muted-foreground">
            Send USDT, USDC, ETH, BTC or SOL from the chain you hold it on. NEAR Intents turns it
            into exactly this many dollars in your balance.
          </p>
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
    </Sheet>
  )
}
