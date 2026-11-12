"use client"

// Books in every state (plan 6.9): Activity (a month, an empty month, loading, error), the refund sheet, and Balance
// with reconciliation (outside transfers, all matched, NearBlocks down), on sample data only.
import { useState } from "react"

import { type ActivityFilter, ActivityView } from "@/components/books/activity-view"
import { BalanceView } from "@/components/books/balance-view"
import { RefundSheet } from "@/components/books/refund-sheet"
import { Segmented } from "@/components/kit/segmented"
import type { MovementView } from "@/lib/client/types"
import { SAMPLE_ACCOUNT, SAMPLE_BOOKS, SAMPLE_RECONCILIATION } from "@/lib/dev/sample"

type ActivityState = "month" | "empty" | "loading" | "error"
type BalanceState = "outside" | "matched" | "down"

export default function BooksFlow() {
  const [state, setState] = useState<ActivityState>("month")
  const [balance, setBalance] = useState<BalanceState>("outside")
  const [filter, setFilter] = useState<ActivityFilter>("all")
  const [query, setQuery] = useState("")
  const [refunding, setRefunding] = useState<MovementView | null>(null)
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
        </div>
        <BalanceView
          balance="5750000"
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
          onReceive={() => undefined}
          onTestDollars={() => undefined}
        />
      </section>
    </div>
  )
}
