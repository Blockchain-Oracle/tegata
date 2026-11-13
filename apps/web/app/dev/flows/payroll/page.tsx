"use client"

// Payroll in every state: the payroll page (scheduled, setting the schedule, no team yet, loading,
// error) and a run (review, paying, paid with its seal, failed with nothing moved), on sample data only.
import { parseDollars } from "@tegata/core/invoices"
import { rowTotal } from "@tegata/core/payroll"
import { useState } from "react"

import { Segmented } from "@/components/kit/segmented"
import { AutopilotCard, AutopilotSheet } from "@/components/payroll/autopilot-card"
import { PayrollView } from "@/components/payroll/payroll-view"
import { RowPaySheet } from "@/components/payroll/row-pay-sheet"
import { RunView } from "@/components/payroll/run-view"
import type { PayRun, PayRunRow } from "@/lib/client/types"
import {
  SAMPLE_AUTOPILOT,
  SAMPLE_AUTOPILOT_PREVIEW,
  SAMPLE_BUSINESS,
  SAMPLE_PAYROLL,
  SAMPLE_PEOPLE,
  SAMPLE_RUN,
} from "@/lib/dev/sample"

type PageState = "scheduled" | "unscheduled" | "no-team" | "loading" | "error"
type RunState = "review" | "paying" | "delivering" | "paid" | "failed"
type AutopilotState = keyof typeof SAMPLE_AUTOPILOT

const TX = "7hEg9DgZdEaq7e4AHtY9FZ4ReB3sveq5XwewiEanCKFr"

function runIn(state: RunState): PayRun {
  if (state === "review") return SAMPLE_RUN
  const rows = SAMPLE_RUN.rows.map((row) =>
    row.status !== "included"
      ? row
      : state === "paying"
        ? { ...row, batch: 1, relayStatus: "sent" as const }
        : state === "delivering"
          ? // Mei's row on NEAR is paid; Kofi's, in USDT on Tron, left NEAR and is on its way.
            row.destinationKind === "near"
            ? {
                ...row,
                batch: 1,
                destinationKind: "chain" as const,
                route: "usdt-tron",
                accountId: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
                status: "sending" as const,
                relayStatus: "success" as const,
                txHash: TX,
              }
            : {
                ...row,
                batch: 1,
                status: "paid" as const,
                relayStatus: "success" as const,
                txHash: TX,
              }
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
    status: state === "paying" || state === "delivering" ? "approved" : state,
    error: state === "failed" ? "Delegate action expired before it was sent" : null,
    transactions:
      state === "paid" ? [{ hash: TX, url: `https://testnet.nearblocks.io/txns/${TX}` }] : [],
  }
}

export default function PayrollFlow() {
  const [page, setPage] = useState<PageState>("scheduled")
  const [run, setRun] = useState<RunState>("review")
  const [editing, setEditing] = useState<PayRunRow | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<PayRunRow>>>({})
  // A run with the sheet's edits applied, its total from the included rows.
  const edited = (shown: PayRun): PayRun => {
    if (shown.status !== "draft" || !Object.keys(edits).length) return shown
    const rows = shown.rows.map((row) => ({ ...row, ...edits[row.id] }))
    const total = rows
      .filter((row) => row.status === "included")
      .reduce((sum, row) => sum + BigInt(row.amount), 0n)
    return { ...shown, rows, total: total.toString() }
  }
  const [autopilot, setAutopilot] = useState<AutopilotState>("on")
  const [sheet, setSheet] = useState(false)
  const [count, setCount] = useState(3)
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
          <span className="display text-[30px]">Autopilot</span>
          <Segmented
            label="Autopilot state"
            value={autopilot}
            onValueChange={(v) => setAutopilot(v as AutopilotState)}
            options={[
              { value: "off", label: "Off" },
              { value: "setting-up", label: "Setting up" },
              { value: "on", label: "On" },
              { value: "paused", label: "Paused" },
              { value: "underfunded", label: "Short" },
              { value: "left-over", label: "Left over" },
            ]}
          />
        </div>
        <AutopilotCard
          view={SAMPLE_AUTOPILOT[autopilot]}
          canSetUp
          busy={false}
          problem={null}
          onSetUp={() => setSheet(true)}
          onAction={() => undefined}
        />
        <AutopilotSheet
          open={sheet}
          onOpenChange={setSheet}
          preview={SAMPLE_AUTOPILOT_PREVIEW}
          count={count}
          onCount={setCount}
          balance="8040000000"
          busy={false}
          problem={null}
          onTurnOn={() => setSheet(false)}
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
              { value: "delivering", label: "On its way" },
              { value: "paid", label: "Paid" },
              { value: "failed", label: "Failed" },
            ]}
          />
        </div>
        <RunView
          run={edited(runIn(run))}
          error={false}
          onReload={() => undefined}
          business={SAMPLE_BUSINESS}
          balance="8040000000"
          busy={false}
          problem={null}
          onToggle={() => undefined}
          onEdit={setEditing}
          onPay={() => setRun("paying")}
          onRetry={() => setRun("review")}
        />
        <RowPaySheet
          row={editing}
          period={SAMPLE_RUN.label}
          busy={false}
          problem={null}
          onOpenChange={(open) => !open && setEditing(null)}
          onSave={(row, input) => {
            // The sample run takes the edit as the server would: pay (or usual) plus lines.
            const lines = input.lines.map((line) => ({
              ...line,
              amount: (parseDollars(line.amount) ?? 0n).toString(),
            }))
            const pay = input.pay === null ? null : (parseDollars(input.pay) ?? 0n)
            const amount = rowTotal(
              pay ?? BigInt(row.usual ?? row.amount),
              lines.map((line) => ({ ...line, amount: BigInt(line.amount) })),
            )
            setEdits((all) => ({
              ...all,
              [row.id]: { pay: pay?.toString() ?? null, lines, amount: amount.toString() },
            }))
            setEditing(null)
          }}
        />
      </section>
    </div>
  )
}
