"use client"

// Pots: the business's own share of every payment in, set aside as Tax and Savings on its one NEAR account. A bar of
// spendable, tax and savings; a row per pot with "Move to spending"; the split rule with presets and a live example.
// Pots are labels: the money never leaves the account, and nothing is paid to a tax office.
import { ArrowDownToLine, ArrowUpFromLine, PiggyBank } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Switch } from "@/components/kit/switch"
import { Sheet } from "@/components/shell/sheet"
import { fire } from "@/lib/feedback"
import { usdUnits } from "@/lib/fiat"
import { cn } from "@/lib/utils"

export interface PotsView {
  rule: { on: boolean; taxBps: number; savingsBps: number }
  tax: string
  savings: string
  spendable: string
  balance: string
}

export type PotKind = "tax" | "savings"

const PRESETS = [
  { label: "Freelancer", tax: 25, savings: 10 },
  { label: "Light", tax: 15, savings: 5 },
  { label: "Savings only", tax: 0, savings: 20 },
] as const

// Each pot is a story field (kin for tax, matcha for savings); its dot and bar segment keep the full colour in dark mode.
const POT = {
  tax: { name: "Tax", swatch: "bg-pot-tax", field: "bg-kin" },
  savings: { name: "Savings", swatch: "bg-pot-savings", field: "bg-matcha" },
} as const

export function PotsCard({
  view,
  busy,
  problem,
  onRule,
  onMove,
}: {
  view: PotsView | undefined
  busy: boolean
  problem: string | null
  onRule: (rule: PotsView["rule"]) => void
  onMove: (input: { kind: PotKind; direction: "to_spending" | "to_pot"; amount: string }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [tax, setTax] = useState("")
  const [savings, setSavings] = useState("")
  const [move, setMove] = useState<{ kind: PotKind; direction: "to_spending" | "to_pot" } | null>(
    null,
  )
  const [amount, setAmount] = useState("")

  if (!view)
    return <div className="h-[220px] animate-skeleton rounded-[24px] bg-card" aria-hidden />

  const balance = BigInt(view.balance)
  const parts = [
    { key: "spendable", units: BigInt(view.spendable), swatch: "bg-foreground" },
    { key: "tax", units: BigInt(view.tax), swatch: POT.tax.swatch },
    { key: "savings", units: BigInt(view.savings), swatch: POT.savings.swatch },
  ]
  const total = parts.reduce((sum, p) => sum + p.units, 0n)
  const taxPct = Number(tax || view.rule.taxBps / 100)
  const savingsPct = Number(savings || view.rule.savingsBps / 100)
  const shares = editing
    ? { tax: taxPct, savings: savingsPct }
    : {
        tax: view.rule.taxBps / 100,
        savings: view.rule.savingsBps / 100,
      }
  const example = (pct: number) => (1000 * (Number.isFinite(pct) ? pct : 0)) / 100
  const valid =
    Number.isInteger(taxPct) &&
    Number.isInteger(savingsPct) &&
    taxPct >= 0 &&
    savingsPct >= 0 &&
    taxPct + savingsPct <= 90 &&
    taxPct + savingsPct > 0

  // Off and holding nothing: the card is a prompt, not two empty pots.
  const empty = !view.rule.on && BigInt(view.tax) === 0n && BigInt(view.savings) === 0n

  const openEditor = () => {
    setTax(String(view.rule.taxBps / 100 || 25))
    setSavings(String(view.rule.savingsBps / 100 || 10))
    setEditing(true)
  }

  return (
    <section className="flex flex-col gap-5 rounded-[24px] bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[17px] font-semibold">
          <PiggyBank className="size-5" /> Pots
        </span>
        <span className="flex items-center gap-3">
          <span className="text-[14px] font-medium text-muted-foreground">Split money in</span>
          <Switch
            checked={view.rule.on}
            disabled={busy}
            label="Split money in"
            onCheckedChange={(on) => {
              if (on && view.rule.taxBps + view.rule.savingsBps === 0) openEditor()
              else onRule({ ...view.rule, on })
            }}
          />
        </span>
      </div>

      {empty && !editing ? (
        // Nothing split yet: one prompt with the next action instead of two empty pots.
        <div className="flex flex-wrap items-center gap-4 rounded-[20px] bg-secondary/60 p-4">
          <span className="flex -space-x-2" aria-hidden>
            <span className="size-8 rounded-full bg-pot-tax ring-2 ring-card" />
            <span className="size-8 rounded-full bg-pot-savings ring-2 ring-card" />
          </span>
          <span className="min-w-[12rem] flex-1 text-[15px] font-medium">
            Set a share of every payment aside for tax and savings.
          </span>
          <Button size="sm" onClick={openEditor}>
            Set the shares
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {/* Segments grow by their share, with a hairline gap between them. */}
            <div className="flex h-4 w-full gap-[3px] overflow-hidden rounded-full bg-secondary">
              {total > 0n
                ? parts.map((p) =>
                    p.units > 0n ? (
                      <span
                        key={p.key}
                        className={cn(
                          "h-full min-w-1 transition-[flex-grow] duration-500",
                          p.swatch,
                        )}
                        style={{ flex: `${Number((p.units * 10000n) / total)} 1 0%` }}
                      />
                    ) : null,
                  )
                : null}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Legend swatch="bg-foreground" label="To spend" value={usdUnits(view.spendable)} />
              <Legend swatch={POT.tax.swatch} label="Tax" value={usdUnits(view.tax)} />
              <Legend swatch={POT.savings.swatch} label="Savings" value={usdUnits(view.savings)} />
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            {(["tax", "savings"] as const).map((kind) => {
              const held = kind === "tax" ? view.tax : view.savings
              const bps = kind === "tax" ? view.rule.taxBps : view.rule.savingsBps
              return (
                <div
                  key={kind}
                  className={cn(
                    "flex flex-col gap-4 rounded-[20px] p-4 text-field-ink",
                    POT[kind].field,
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-semibold">{POT[kind].name}</span>
                    <span className="text-[13px] font-medium opacity-70">
                      {view.rule.on && bps > 0 ? `${bps / 100}% of each payment` : "Not splitting"}
                    </span>
                  </span>
                  <span className="display tnum text-[34px] leading-none">{usdUnits(held)}</span>
                  <span className="flex flex-wrap gap-2">
                    <Button
                      variant="paper"
                      size="sm"
                      disabled={BigInt(held) === 0n}
                      onClick={() => {
                        setAmount("")
                        setMove({ kind, direction: "to_spending" })
                      }}
                    >
                      <ArrowUpFromLine /> To spending
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-field-ink hover:bg-black/8 dark:hover:bg-white/10"
                      disabled={BigInt(view.spendable) === 0n}
                      onClick={() => {
                        setAmount("")
                        setMove({ kind, direction: "to_pot" })
                      }}
                    >
                      <ArrowDownToLine /> Add
                    </Button>
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {editing ? (
        <div className="flex flex-col gap-4 rounded-[16px] bg-secondary/50 p-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  fire("tick")
                  setTax(String(p.tax))
                  setSavings(String(p.savings))
                }}
                className={cn(
                  "press rounded-full px-3 py-1.5 text-[13px] font-semibold",
                  taxPct === p.tax && savingsPct === p.savings
                    ? "bg-foreground text-background"
                    : "bg-card",
                )}
              >
                {p.label} {p.tax} · {p.savings}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="pot-tax"
              label="Tax %"
              inputMode="numeric"
              value={tax}
              onChange={(e) => setTax(e.target.value.replace(/[^\d]/g, ""))}
            />
            <Field
              id="pot-savings"
              label="Savings %"
              inputMode="numeric"
              value={savings}
              onChange={(e) => setSavings(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
          <p className="tnum text-[14px] text-muted-foreground">
            $1,000 in → ${example(shares.tax).toFixed(0)} tax · $
            {example(shares.savings).toFixed(0)} savings · $
            {(1000 - example(shares.tax) - example(shares.savings)).toFixed(0)} to spend
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              busy={busy}
              disabled={!valid}
              onClick={() => {
                onRule({ on: true, taxBps: taxPct * 100, savingsBps: savingsPct * 100 })
                setEditing(false)
              }}
            >
              Split from now on
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : empty ? null : (
        <button
          type="button"
          onClick={openEditor}
          className="self-start text-[14px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {view.rule.taxBps + view.rule.savingsBps > 0 ? "Change the shares" : "Set the shares"}
        </button>
      )}

      {problem ? <p className="text-[14px] font-medium text-down">{problem}</p> : null}
      <p className="text-[13px] text-muted-foreground">
        Labels on your one NEAR account: the money stays put, and nothing is paid to a tax office.
        {balance === 0n ? " Pots fill as payments arrive." : ""}
      </p>

      <Sheet
        open={move !== null}
        onOpenChange={(open) => !open && setMove(null)}
        title={
          move
            ? move.direction === "to_spending"
              ? `From ${POT[move.kind].name} to spending`
              : `Into ${POT[move.kind].name}`
            : ""
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!move) return
            onMove({ ...move, amount })
            setMove(null)
          }}
        >
          <Field
            id="pot-amount"
            label="Amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="text-[14px] text-muted-foreground">
            {move?.direction === "to_spending"
              ? `Up to ${usdUnits(move.kind === "tax" ? view.tax : view.savings)}`
              : `Up to ${usdUnits(view.spendable)} to spend`}
          </span>
          <Button type="submit" busy={busy} disabled={!/^\d+(\.\d{1,2})?$/.test(amount.trim())}>
            Move
          </Button>
        </form>
      </Sheet>
    </section>
  )
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <span className={cn("size-2.5 rounded-full", swatch)} /> {label}
      </span>
      <span className="tnum text-[17px] font-semibold">{value}</span>
    </span>
  )
}
