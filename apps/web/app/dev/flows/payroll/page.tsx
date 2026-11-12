"use client"

// Payroll in every state (plan 6.9): the payroll page (scheduled, setting the schedule, no team yet, loading,
// error) and a run (review, paying, paid with its seal, failed with nothing moved), on sample data only.
import { useState } from "react"

import { Segmented } from "@/components/kit/segmented"
import { PayrollView } from "@/components/payroll/payroll-view"
import { RunView } from "@/components/payroll/run-view"
import type { PayRun } from "@/lib/client/types"
import { SAMPLE_BUSINESS, SAMPLE_PAYROLL, SAMPLE_PEOPLE, SAMPLE_RUN } from "@/lib/dev/sample"

type PageState = "scheduled" | "unscheduled" | "no-team" | "loading" | "error"
type RunState = "review" | "paying" | "paid" | "failed"

const TX = "7hEg9DgZdEaq7e4AHtY9FZ4ReB3sveq5XwewiEanCKFr"

function runIn(state: RunState): PayRun {
  if (state === "review") return SAMPLE_RUN
  const rows = SAMPLE_RUN.rows.map((row) =>
    row.status !== "included"
      ? row
      : state === "paying"
        ? { ...row, batch: 1, relayStatus: "sent" as const }
        : state === "paid"
          ? {
              ...row,
              batch: 1,
              status: "paid" as const,
              relayStatus: "success" as const,
              txHash: TX,
            }
          : { ...row, batch: 1, status: "failed" as const, relayStatus: "failed" as const },
  )
  return {
    ...SAMPLE_RUN,
    rows,
    status: state === "paying" ? "approved" : state,
    error: state === "failed" ? "Delegate action expired before it was sent" : null,
    transactions:
      state === "paid" ? [{ hash: TX, url: `https://testnet.nearblocks.io/txns/${TX}` }] : [],
  }
}

export default function PayrollFlow() {
  const [page, setPage] = useState<PageState>("scheduled")
  const [run, setRun] = useState<RunState>("review")
  return (
    <div className="flex flex-col gap-12 pt-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">Payroll</span>
          <Segmented
            label="State"
            value={page}
            onValueChange={(v) => setPage(v as PageState)}
            options={[
              { value: "scheduled", label: "Scheduled" },
              { value: "unscheduled", label: "No schedule" },
              { value: "no-team", label: "No team" },
              { value: "loading", label: "Loading" },
              { value: "error", label: "Error" },
            ]}
          />
        </div>
        <PayrollView
          overview={
            page === "loading" || page === "error"
              ? undefined
              : page === "unscheduled"
                ? { ...SAMPLE_PAYROLL, schedule: null, runs: [] }
                : SAMPLE_PAYROLL
          }
          people={
            page === "no-team"
              ? []
              : page === "loading" || page === "error"
                ? undefined
                : SAMPLE_PEOPLE
          }
          error={page === "error"}
          onRetry={() => setPage("scheduled")}
          today="2026-11-12"
          savingSchedule={false}
          scheduleProblem={null}
          onSaveSchedule={() => setPage("scheduled")}
          starting={false}
          startProblem={null}
          onRun={() => undefined}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">A run</span>
          <Segmented
            label="Run state"
            value={run}
            onValueChange={(v) => setRun(v as RunState)}
            options={[
              { value: "review", label: "Review" },
              { value: "paying", label: "Paying" },
              { value: "paid", label: "Paid" },
              { value: "failed", label: "Failed" },
            ]}
          />
        </div>
        <RunView
          run={runIn(run)}
          error={false}
          onReload={() => undefined}
          business={SAMPLE_BUSINESS}
          balance="8040000000"
          busy={false}
          problem={null}
          onToggle={() => undefined}
          onPay={() => setRun("paying")}
          onRetry={() => setRun("review")}
        />
      </section>
    </div>
  )
}
