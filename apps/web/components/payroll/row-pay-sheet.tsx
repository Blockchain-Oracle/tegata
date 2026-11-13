"use client"

// One person's pay for this run: this run's pay (their usual pay unless changed) and one-off lines (bonus,
// reimbursement, deduction), with what they get worked out as you type. Only this run changes; their usual pay
// stays. The server checks the same rules (`payLinesProblem`) before it saves.
import { parseDollars } from "@tegata/core/invoices"
import { type PayLine, type PayLineKind, payLinesProblem, rowTotal } from "@tegata/core/payroll"
import { Plus, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Sheet } from "@/components/shell/sheet"
import type { PayRowLine, PayRunRow } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"
import { money } from "./payroll-view"

export const LINE_KINDS: { kind: PayLineKind; word: string; field: string }[] = [
  { kind: "bonus", word: "Bonus", field: "bg-matcha" },
  { kind: "reimbursement", word: "Reimbursement", field: "bg-sora" },
  { kind: "deduction", word: "Deduction", field: "bg-sakura" },
]
const KIND = Object.fromEntries(LINE_KINDS.map((k) => [k.kind, k])) as Record<
  PayLineKind,
  (typeof LINE_KINDS)[number]
>

interface DraftLine {
  key: number
  kind: PayLineKind
  label: string
  amount: string
}

/** Base units to what a person types back into a field ("2400", "42.50"). */
const typed = (units: string | bigint) => {
  const cents = BigInt(units) / 10_000n
  const whole = cents / 100n
  const rest = cents % 100n
  return rest ? `${whole}.${rest.toString().padStart(2, "0")}` : whole.toString()
}

export interface RowPayInput {
  /** Dollars as typed, or null for their usual pay. */
  pay: string | null
  lines: { kind: PayLineKind; label: string; amount: string }[]
}

export function RowPaySheet({
  row,
  period,
  busy,
  problem,
  onOpenChange,
  onSave,
}: {
  row: PayRunRow | null
  /** The run's label: "Pay · 1–30 Nov 2026". */
  period: string
  busy: boolean
  problem: string | null
  onOpenChange: (open: boolean) => void
  onSave: (row: PayRunRow, input: RowPayInput) => void
}) {
  const usual = BigInt(row?.usual ?? row?.amount ?? "0")
  const [pay, setPay] = useState("")
  const [lines, setLines] = useState<DraftLine[]>([])
  const [nextKey, setNextKey] = useState(0)

  // Fill the sheet from the row each time a row opens it.
  useEffect(() => {
    if (!row) return
    setPay(typed(row.pay ?? row.usual ?? row.amount))
    const saved = row.lines ?? []
    setLines(
      saved.map((line: PayRowLine, i) => ({
        key: i,
        kind: line.kind,
        label: line.label,
        amount: typed(line.amount),
      })),
    )
    setNextKey(saved.length)
  }, [row])

  const payUnits = parseDollars(pay)
  const parsed: PayLine[] = []
  let unreadable = false
  for (const line of lines) {
    const amount = parseDollars(line.amount)
    if (amount === null) unreadable = true
    else parsed.push({ kind: line.kind, label: line.label.trim(), amount })
  }
  const total = payUnits === null ? null : rowTotal(payUnits, parsed)
  const why =
    payUnits === null
      ? "Enter this run's pay in dollars"
      : unreadable
        ? "Give each line an amount in dollars"
        : payLinesProblem(payUnits, parsed)
  const first = row?.name.split(" ")[0] ?? "They"

  const add = (kind: PayLineKind) => {
    fire("tick")
    setLines((all) => [...all, { key: nextKey, kind, label: "", amount: "" }])
    setNextKey((k) => k + 1)
  }
  const change = (key: number, patch: Partial<DraftLine>) =>
    setLines((all) => all.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  return (
    <Sheet open={row !== null} onOpenChange={onOpenChange} title={`${row?.name ?? ""}'s pay`}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!row || why || payUnits === null) return
          onSave(row, {
            pay: payUnits === usual ? null : pay.trim(),
            lines: lines.map(({ kind, label, amount }) => ({
              kind,
              label: label.trim(),
              amount: amount.trim(),
            })),
          })
        }}
      >
        <span className="-mt-2 text-[15px] text-muted-foreground">{period}</span>

        <Field
          id="row-pay"
          label="Pay this run"
          inputMode="decimal"
          leading={<span className="text-muted-foreground">$</span>}
          value={pay}
          onChange={(e) => setPay(e.target.value)}
          trailing={
            payUnits !== null && payUnits !== usual ? (
              <button
                type="button"
                onClick={() => setPay(typed(usual))}
                className="whitespace-nowrap text-[14px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Usual {money(usual)} · Reset
              </button>
            ) : null
          }
        />

        {lines.length ? (
          <div className="flex flex-col gap-2">
            {lines.map((line) => (
              <div
                key={line.key}
                className="flex flex-col gap-2 rounded-[16px] bg-secondary/60 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[13px] font-semibold text-field-ink",
                      KIND[line.kind].field,
                    )}
                  >
                    {line.kind === "deduction" ? "−" : "+"} {KIND[line.kind].word}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove this ${KIND[line.kind].word.toLowerCase()}`}
                    onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                    className="press grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-plate-pressed hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    aria-label={`${KIND[line.kind].word} label`}
                    placeholder={
                      line.kind === "bonus"
                        ? "Q4 target"
                        : line.kind === "reimbursement"
                          ? "Train tickets"
                          : "Laptop advance"
                    }
                    maxLength={60}
                    value={line.label}
                    onChange={(e) => change(line.key, { label: e.target.value })}
                    className="h-11 min-w-0 flex-1 rounded-[12px] bg-card px-3 text-[15px] outline-none placeholder:text-text-3 focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="flex h-11 w-32 items-center gap-1 rounded-[12px] bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
                    <span className="text-muted-foreground">$</span>
                    <input
                      aria-label={`${KIND[line.kind].word} amount`}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={line.amount}
                      onChange={(e) => change(line.key, { amount: e.target.value })}
                      className="tnum h-full min-w-0 flex-1 bg-transparent text-right text-[15px] outline-none placeholder:text-text-3"
                    />
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {LINE_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => add(k.kind)}
              className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-[14px] font-semibold hover:bg-plate-pressed [&_svg]:size-4"
            >
              <Plus /> {k.word}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1 rounded-[20px] bg-card p-4 ring-1 ring-rule">
          <span className="text-[15px] font-medium text-muted-foreground">{first} gets</span>
          <Figure
            value={viewDollars(total !== null && total > 0n ? total : 0n)}
            className="text-[44px]"
          />
          {payUnits !== null && parsed.length ? (
            <span className="tnum text-[14px] text-muted-foreground">
              {money(payUnits)} pay
              {lines.map((line) => {
                const amount = parseDollars(line.amount)
                return amount === null ? null : (
                  <span key={line.key}>
                    {line.kind === "deduction" ? " − " : " + "}
                    {money(amount)} {KIND[line.kind].word.toLowerCase()}
                  </span>
                )
              })}
            </span>
          ) : null}
        </div>

        {why && (lines.length || payUnits === null) ? (
          <p className="text-[14px] font-medium text-down">{why}</p>
        ) : null}
        {problem ? <p className="text-[14px] font-medium text-down">{problem}</p> : null}

        <div className="flex flex-col gap-2">
          <Button type="submit" block busy={busy} disabled={Boolean(why)}>
            Save for this run
          </Button>
          <span className="text-center text-[13px] text-muted-foreground">
            Only this run. Their usual pay stays {money(usual)}.
          </span>
        </div>
      </form>
    </Sheet>
  )
}

/** "$2,400.00 + $250.00 bonus", "Usual $2,400.00": what changed on a row, in one line. */
export function rowChangeText(row: PayRunRow): string | null {
  const lines = row.lines ?? []
  if (!lines.length && row.pay == null) return null
  const base = BigInt(row.pay ?? row.usual ?? row.amount)
  if (!lines.length) return `Usual ${money(row.usual ?? "0")}`
  const [head, ...more] = lines
  if (!head) return null
  const sign = head.kind === "deduction" ? "−" : "+"
  return `${money(base)} ${sign} ${money(head.amount)} ${KIND[head.kind].word.toLowerCase()}${
    more.length ? ` and ${more.length} more` : ""
  }`
}
