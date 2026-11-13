"use client"

// Counter (plan 6.8 Z): type an amount on a keypad, Charge, show the QR on the stage while the customer pays from
// their phone, then the stage turns green and the seal presses. Today's sales below. Phone first. Separate from its
// data so /dev/flows can show every state.
import { Check, Delete, Receipt } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { QRCodeSVG } from "qrcode.react"

import { BusinessSeal, SealPress } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Stage } from "@/components/kit/stage"
import { StatusPill, WaitingText } from "@/components/kit/states"
import { money } from "@/components/payroll/payroll-view"
import { fire } from "@/lib/feedback"

export interface CounterSale {
  id: string
  token: string
  title: string
  amount: string
  status: "open" | "paid" | "closed"
  createdAt: string
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const

/** Apply one key to the typed amount: digits, one point, two decimals at most, a sane maximum. */
export function press(value: string, key: (typeof KEYS)[number]): string {
  if (key === "back") return value.slice(0, -1)
  if (key === "." && value.includes(".")) return value
  if (value.includes(".") && (value.split(".")[1]?.length ?? 0) >= 2) return value
  const next = value === "0" && key !== "." ? key : `${value}${key}`
  return next.replace(/^\./, "0.").length > 9 ? value : next.replace(/^\./, "0.")
}

export function CounterView({
  business,
  amount,
  onAmount,
  note,
  onNote,
  sale,
  paid,
  startedAt,
  busy,
  problem,
  onCharge,
  onNew,
  sales,
}: {
  business: string
  amount: string
  onAmount: (value: string) => void
  note: string
  onNote: (value: string) => void
  /** The sale being paid, if any. */
  sale: { url: string; amount: string } | null
  paid: boolean
  startedAt: number
  busy: boolean
  problem: string | null
  onCharge: () => void
  onNew: () => void
  sales: CounterSale[] | undefined
}) {
  const reduce = useReducedMotion()
  const value = Number.parseFloat(amount || "0") || 0

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5">
      <h1 className="display text-page-title">Counter</h1>
      {sale ? (
        <Stage className="p-6" tone={paid ? "paid" : "shu"}>
          <div className="flex flex-col items-center gap-4 text-center">
            <Figure value={viewDollars(sale.amount)} className="text-[64px] text-white" />
            {paid ? (
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <SealPress
                  onLanded={() =>
                    fire("filled", { cue: "received", identity: `counter:${sale.url}` })
                  }
                >
                  <span className="grid place-items-center rounded-full bg-white p-2 shadow-object">
                    <BusinessSeal name={business} band="Paid" size={120} />
                  </span>
                </SealPress>
                <span className="inline-flex items-center gap-2 text-[18px] font-semibold text-white">
                  <Check className="size-5" /> Paid
                </span>
                <Button variant="paper" size="lg" onClick={onNew}>
                  New sale
                </Button>
              </motion.div>
            ) : (
              <>
                <div className="rounded-[24px] bg-white p-4 shadow-object">
                  <QRCodeSVG
                    value={sale.url}
                    size={240}
                    level="M"
                    imageSettings={{ src: "/icon.svg", height: 48, width: 48, excavate: true }}
                  />
                </div>
                <span className="text-[15px] font-medium text-white/90">
                  Scan to pay with USDC on NEAR
                </span>
                <WaitingText
                  verb="Waiting for payment"
                  startedAt={startedAt}
                  className="text-white"
                />
                <Button variant="paper" size="sm" onClick={onNew}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </Stage>
      ) : (
        <div className="flex flex-col gap-4 rounded-[24px] bg-card p-5">
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="text-detail text-muted-foreground">Charge</span>
            <span className="display tnum text-[64px] leading-none">${amount || "0"}</span>
          </div>
          <input
            value={note}
            onChange={(e) => onNote(e.target.value)}
            maxLength={80}
            placeholder="What it's for (optional)"
            aria-label="What it's for"
            className="h-11 rounded-[12px] bg-secondary px-3 text-center text-[15px] outline-none placeholder:text-text-3"
          />
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-label={key === "back" ? "Delete" : key}
                onClick={() => {
                  fire("tick")
                  onAmount(press(amount, key))
                }}
                className="press grid h-16 place-items-center rounded-[16px] bg-secondary text-[26px] font-semibold hover:bg-plate-pressed"
              >
                {key === "back" ? <Delete className="size-6" /> : key}
              </button>
            ))}
          </div>
          {problem ? (
            <p className="text-center text-[15px] font-medium text-down">{problem}</p>
          ) : null}
          <Button variant="shu" size="lg" busy={busy} disabled={value <= 0} onClick={onCharge}>
            Charge {value > 0 ? `$${value.toFixed(2)}` : ""}
          </Button>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-section-title font-semibold">This month's sales</h2>
        {!sales?.length ? (
          <p className="rounded-[20px] bg-card px-4 py-5 text-[15px] text-muted-foreground">
            Sales from the counter show up here.
          </p>
        ) : (
          <div className="flex flex-col rounded-[20px] bg-card p-2">
            {sales.map((s) => (
              <a
                key={s.id}
                href={`/pay/${s.token}`}
                className="press flex items-center gap-3 rounded-[14px] px-3 py-2.5 hover:bg-secondary"
              >
                <span className="grid size-9 place-items-center rounded-full bg-matcha text-black [&_svg]:size-4">
                  <Receipt />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{s.title}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                {s.status === "paid" ? (
                  <StatusPill tone="up">Paid</StatusPill>
                ) : (
                  <StatusPill tone="quiet">Not paid</StatusPill>
                )}
                <span className="tnum text-[15px] font-semibold">{money(s.amount)}</span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
