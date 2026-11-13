"use client"

// Refund: all of a received payment, or part of it, back to the NEAR account that paid. One gas-free
// transfer with the memo `tegata:refund:<payment>`; the sheet follows it to NEAR, then links its receipt. A payment
// from another chain goes back the way it came: NEAR Intents converts the USDC to the payer's coin and
// delivers it to the address they gave; it counts as refunded once it arrives.
import { Check, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import {
  MovementMark,
  movementTitle,
  shortAccount,
  subjectOfMovement,
} from "@/components/books/movement-mark"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { viewDollars } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Mark } from "@/components/marks/mark"
import { Sheet } from "@/components/shell/sheet"
import type { MovementView, PayoutView } from "@/lib/client/types"
import { coinAmount, usdUnits } from "@/lib/fiat"
import { eta } from "@/lib/routes"

export interface RefundDone {
  relayId: string
  explorerUrl: string | null
  /** A refund to another chain, on its way through NEAR Intents. */
  payout: PayoutView | null
}

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
  done: RefundDone | null
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
  const route = movement?.refundable?.route ?? null

  return (
    <Sheet open={movement !== null} onOpenChange={onOpenChange} title="Refund">
      {movement?.refundable ? (
        done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-up-surface text-up">
              <Check className="size-7" />
            </span>
            {done.payout && route ? (
              <>
                <p className="text-[17px] font-semibold">Refund on its way: {usdUnits(units)}</p>
                <p className="tnum inline-flex flex-wrap items-center justify-center gap-1.5 text-[15px] text-muted-foreground">
                  <Mark id={route.coin} chain={route.chainMark} size={18} />
                  About {coinAmount(done.payout.amountOutFormatted ?? Number.NaN, route.symbol)} to{" "}
                  <span className="font-mono">{shortAccount(movement.refundable.payer)}</span>
                  {done.payout.timeEstimate ? ` · ${eta(done.payout.timeEstimate)}` : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-[17px] font-semibold">Refunded {usdUnits(units)}</p>
                <p className="inline-flex items-center gap-1.5 text-[15px] text-muted-foreground">
                  <Mark id="near" size={18} /> Back to{" "}
                  <span className="font-mono">{shortAccount(movement.refundable.payer)}</span>
                </p>
              </>
            )}
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
            <div className="flex items-center gap-3 rounded-[16px] bg-secondary p-4">
              <MovementMark movement={subjectOfMovement(movement)} size={40} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-detail text-muted-foreground">
                  {movementTitle(movement.title)}
                </span>
                <span className="tnum text-[17px] font-semibold">{usdUnits(left)} can go back</span>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  {route ? (
                    <>
                      {route.symbol} on {route.chain} to
                    </>
                  ) : (
                    "To"
                  )}{" "}
                  <span className="truncate font-mono">
                    {shortAccount(movement.refundable.payer)}
                  </span>
                </span>
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
                units > left ? { kind: "bad", text: `At most ${usdUnits(left)}` } : { kind: "none" }
              }
            />
            {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
            <HoldButton
              label={`Hold to refund ${usdUnits(units)}`}
              ready={valid}
              busy={busy}
              onConfirm={() => onRefund(amount)}
            />
          </div>
        )
      ) : null}
    </Sheet>
  )
}
