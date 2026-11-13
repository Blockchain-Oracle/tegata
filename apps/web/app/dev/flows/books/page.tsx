"use client"

// Books in every state: Activity (a month, an empty month, loading, error), the refund sheet, and Balance
// with reconciliation (outside transfers, all matched, NearBlocks down) and the Pots card (split on, off, loading, an
// error), on sample data only.
import { parseDollars } from "@tegata/core/invoices"
import { useState } from "react"

import { type ActivityFilter, ActivityView } from "@/components/books/activity-view"
import { AddMoneySheet } from "@/components/books/add-money-sheet"
import { BalanceView } from "@/components/books/balance-view"
import { PotsCard, type PotsView } from "@/components/books/pots-card"
import { RefundSheet } from "@/components/books/refund-sheet"
import { Segmented } from "@/components/kit/segmented"
import type { MovementView } from "@/lib/client/types"
import { SAMPLE_ACCOUNT, SAMPLE_BOOKS, SAMPLE_RECONCILIATION } from "@/lib/dev/sample"

type ActivityState = "month" | "empty" | "loading" | "error"
type BalanceState = "outside" | "matched" | "down"
type PotsState = "split" | "off" | "loading" | "problem"

// Math.min doesn't take bigint.
function smaller(a: bigint, b: bigint) {
  if (a < b) return a
  return b
}

// $2,400 on the account: 20% tax and 10% savings set aside from what came in.
const POTS_SPLIT: PotsView = {
  rule: { on: true, taxBps: 2000, savingsBps: 1000 },
  tax: "480000000",
  savings: "240000000",
  spendable: "1680000000",
  balance: "2400000000",
}
const POTS_OFF: PotsView = {
  rule: { on: false, taxBps: 0, savingsBps: 0 },
  tax: "0",
  savings: "0",
  spendable: "2400000000",
  balance: "2400000000",
}

export default function BooksFlow() {
  const [state, setState] = useState<ActivityState>("month")
  const [balance, setBalance] = useState<BalanceState>("outside")
  const [filter, setFilter] = useState<ActivityFilter>("all")
  const [query, setQuery] = useState("")
  const [refunding, setRefunding] = useState<MovementView | null>(null)
  const [adding, setAdding] = useState(false)
  const [potsState, setPotsState] = useState<PotsState>("split")
  const [pots, setPots] = useState<PotsView>(POTS_SPLIT)
  const showPots = (next: PotsState) => {
    setPotsState(next)
    setPots(next === "off" ? POTS_OFF : POTS_SPLIT)
  }
  // The sample pots answer like the API does: the rule saves, a move shifts money between a pot and spending.
  const movePot = (
    kind: "tax" | "savings",
    direction: "to_spending" | "to_pot",
    amount: string,
  ) => {
    const units = parseDollars(amount)
    if (!units) return
    setPots((v) => {
      const pot = BigInt(v[kind])
      const spendable = BigInt(v.spendable)
      const cap = direction === "to_spending" ? pot : spendable
      const moved = smaller(units, cap)
      const sign = direction === "to_spending" ? -1n : 1n
      return {
        ...v,
        [kind]: String(pot + sign * moved),
        spendable: String(spendable - sign * moved),
      }
    })
  }
  return (
    <div className="flex flex-col gap-12 pt-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">Activity</span>
          <Segmented
            label="State"
            value={state}
            onValueChange={(v) => setState(v as ActivityState)}
            options={[
              { value: "month", label: "A month" },
              { value: "empty", label: "Empty" },
              { value: "loading", label: "Loading" },
              { value: "error", label: "Error" },
            ]}
          />
        </div>
        <ActivityView
          data={
            state === "month"
              ? SAMPLE_BOOKS
              : state === "empty"
                ? { ...SAMPLE_BOOKS, moneyIn: "0", moneyOut: "0", net: "0", movements: [] }
                : undefined
          }
          error={state === "error"}
          onRetry={() => setState("month")}
          onPrev={() => undefined}
          onNext={() => undefined}
          canNext={false}
          filter={filter}
          onFilter={setFilter}
          query={query}
          onQuery={setQuery}
          exporting={null}
          onExport={() => undefined}
          onRefund={setRefunding}
          businessName="Studio Kaze"
        />
        <RefundSheet
          movement={refunding}
          onOpenChange={(open) => !open && setRefunding(null)}
          busy={false}
          problem={null}
          done={null}
          onRefund={() => setRefunding(null)}
        />
      </section>
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">Balance</span>
          <Segmented
            label="Reconciliation"
            value={balance}
            onValueChange={(v) => setBalance(v as BalanceState)}
            options={[
              { value: "outside", label: "Outside Tegata" },
              { value: "matched", label: "All matched" },
              { value: "down", label: "NearBlocks down" },
            ]}
          />
          <Segmented
            label="Pots"
            value={potsState}
            onValueChange={(v) => showPots(v as PotsState)}
            options={[
              { value: "split", label: "Split on" },
              { value: "off", label: "Off" },
              { value: "loading", label: "Loading" },
              { value: "problem", label: "Error" },
            ]}
          />
        </div>
        <BalanceView
          balance={pots.balance}
          setAside="11000000000"
          accountId={SAMPLE_ACCOUNT}
          reconciliation={
            balance === "matched"
              ? { ...SAMPLE_RECONCILIATION, outside: [] }
              : SAMPLE_RECONCILIATION
          }
          reconcileError={
            balance === "down" ? "NearBlocks didn't answer. Try again in a minute." : null
          }
          onReconcile={() => undefined}
          onAddMoney={() => setAdding(true)}
          pots={
            <PotsCard
              view={potsState === "loading" ? undefined : pots}
              busy={false}
              problem={
                potsState === "problem" ? "Tax and savings together can be at most 90%" : null
              }
              onRule={(rule) => setPots((v) => ({ ...v, rule }))}
              onMove={({ kind, direction, amount }) => movePot(kind, direction, amount)}
            />
          }
        />
        <AddMoneySheet
          open={adding}
          onOpenChange={setAdding}
          live={false}
          accountId={SAMPLE_ACCOUNT}
          onPayAddress={() => undefined}
          testDollars={{ state: "idle", error: null, explorerUrl: null }}
          onTestDollars={() => undefined}
          chain={{ busy: false, problem: null, onContinue: () => setAdding(false) }}
        />
      </section>
    </div>
  )
}
