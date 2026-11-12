"use client"

// Refund (plan 6.8 X): all of a received payment, or part of it, back to the NEAR account that paid. One gas-free
// transfer with the memo `tegata:refund:<payment>`; the sheet follows it to NEAR, then links its receipt.
import { Check, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { viewDollars } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Mark } from "@/components/marks/mark"
import { money } from "@/components/payroll/payroll-view"
import { Sheet } from "@/components/shell/sheet"
import type { MovementView } from "@/lib/client/types"

export function RefundSheet({
  movement,
  onOpenChange,
  busy,
  problem,
  done,
  onRefund,
}: {
  movement: MovementView | null
  onOpenChange: (open: boolean) => void
  busy: boolean
  problem: string | null
  /** The refund's relay, once NEAR has it. */
  done: { relayId: string; explorerUrl: string | null } | null
  onRefund: (amount: string) => void
}) {
  const [amount, setAmount] = useState("")
  const left = movement?.refundable ? BigInt(movement.refundable.left) : 0n
  useEffect(() => {
    if (movement?.refundable) setAmount(viewDollars(movement.refundable.left).toFixed(2))
  }, [movement])
  const units =
    BigInt(Math.round((Number.parseFloat(amount.replaceAll(",", "")) || 0) * 100)) * 10_000n
  const valid = units > 0n && units <= left

  return (
    <Sheet open={movement !== null} onOpenChange={onOpenChange} title="Refund">
      {movement?.refundable ? (
        done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-up-surface text-up">
              <Check className="size-7" />
            </span>
            <p className="text-[17px] font-semibold">Refunded {money(units)}</p>
            <p className="text-[15px] text-muted-foreground">
              It's back in {movement.refundable.payer}.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/r/send/${done.relayId}`}>Receipt</Link>
              </Button>
              {done.explorerUrl ? (
                <Button variant="secondary" size="sm" asChild>
                  <a href={done.explorerUrl} target="_blank" rel="noreferrer">
                    See it on NEAR <ExternalLink />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 rounded-[16px] bg-secondary p-4">
              <span className="text-detail text-muted-foreground">{movement.title}</span>
              <span className="text-[17px] font-semibold">
                {money(movement.amount)} received · {money(left)} can be refunded
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 font-mono text-[13px] text-muted-foreground">
                <Mark id="near" size={16} /> back to {movement.refundable.payer}
              </span>
            </div>
            <Field
              id="refund-amount"
              label="Amount"
              inputMode="decimal"
              leading={<span className="text-[17px] font-semibold text-text-3">$</span>}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              status={
                units > left ? { kind: "bad", text: `At most ${money(left)}` } : { kind: "none" }
              }
            />
            {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
            <HoldButton
              label={`Hold to refund ${money(units)}`}
              ready={valid}
              busy={busy}
              onConfirm={() => onRefund(amount)}
            />
            <p className="-mt-2 text-center text-detail text-muted-foreground">
              Gas-free: Tegata pays the network fee. It gets its own receipt.
            </p>
          </div>
        )
      ) : null}
    </Sheet>
  )
}
