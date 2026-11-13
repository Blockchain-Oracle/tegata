"use client"

// A payroll run (plan 6.8 R): review every row (include switch, skipped rows with their reason, the total against the
// balance), hold to pay, watch it land, then each row's payslip and the NEAR transaction. A batch is all-or-nothing:
// if it fails, nothing in it moved, and Retry drafts it again.
import { ArrowLeft, ExternalLink, FileText, KeyRound, Radio } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { BusinessSeal, SealPress } from "@/components/brand/seal"
import { CustomerDisc } from "@/components/invoices/customer-picker"
import { AccountLink } from "@/components/kit/account-link"
import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Stage } from "@/components/kit/stage"
import { ErrorState, LoadingShape, StatusPill } from "@/components/kit/states"
import { Switch } from "@/components/kit/switch"
import { TaskSteps } from "@/components/kit/task-steps"
import { MarkStack } from "@/components/marks/mark"
import { DestinationMark } from "@/components/people/destination"
import type { PayRun, PayRunRow } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"
import { money, paydayText, RunStatusPill } from "./payroll-view"

const STEPS = [
  {
    id: "sign",
    label: "Approved with your key",
    detail: "one signature per 50 people",
    icon: <KeyRound />,
  },
  { id: "relay", label: "Sent by Tegata", detail: "network fee paid by Tegata", icon: <Radio /> },
  {
    id: "near",
    label: "Paying everyone on NEAR",
    detail: "all or nothing, per batch",
    mark: "near" as const,
  },
]

export function RunView({
  run,
  error,
  onReload,
  business,
  balance,
  busy,
  problem,
  onToggle,
  onPay,
  onRetry,
}: {
  run: PayRun | undefined
  error: boolean
  onReload: () => void
  business: string
  /** The business's balance in base units, or null while it loads. */
  balance: string | null
  busy: boolean
  problem: string | null
  onToggle: (row: PayRunRow, included: boolean) => void
  onPay: () => void
  onRetry: () => void
}) {
  const reduce = useReducedMotion()
  const header = (
    <header className="flex items-center gap-3">
      <Link
        href="/app/payroll"
        aria-label="Back to payroll"
        className="press grid size-10 place-items-center rounded-full bg-secondary hover:bg-plate-pressed"
      >
        <ArrowLeft className="size-4" />
      </Link>
      <h1 className="display min-w-0 flex-1 truncate text-page-title">
        {run?.label ?? "Payroll run"}
      </h1>
      {run?.source === "autopilot" ? <StatusPill tone="wait">By autopilot</StatusPill> : null}
      {run ? <RunStatusPill status={run.status} /> : null}
    </header>
  )
  if (error)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState
          title="Couldn't load this run"
          detail="Nothing moves while this is down."
          onRetry={onReload}
        />
      </div>
    )
  if (!run)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <LoadingShape shape="card" className="h-[180px] rounded-[24px]" />
        <div className="rounded-[20px] bg-card p-3">
          <LoadingShape shape="list" />
        </div>
      </div>
    )

  const included = run.rows.filter((r) => r.status === "included")
  const paid = run.rows.filter((r) => r.status === "paid")
  const skipped = run.rows.filter((r) => r.status === "skipped")
  const total = BigInt(run.total)
  const short = balance !== null && BigInt(balance) < total
  const batches = new Set(included.map((r) => r.batch)).size
  const settledBatches = new Set(
    run.rows.filter((r) => r.batch && r.relayStatus === "success").map((r) => r.batch),
  ).size
  const progress =
    run.status === "paid"
      ? 3
      : settledBatches > 0 || run.rows.some((r) => r.relayStatus === "sent")
        ? 2
        : 1
  const slide = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      {run.status === "draft" ? (
        <motion.div key="review" className="flex flex-col gap-5" {...slide}>
          <Stage className="p-6 sm:p-8">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 text-[15px] font-medium text-white/85">
                <MarkStack ids={["usdc", "near"]} size={22} /> Payday {paydayText(run.payday)}
              </span>
              <Figure
                value={viewDollars(total)}
                className="text-[56px] text-white sm:text-[72px]"
              />
              <span className="text-[15px] font-medium text-white/85">
                {balance === null
                  ? `to ${included.length} ${included.length === 1 ? "person" : "people"}`
                  : `You have ${money(balance)} · this run is ${money(total)}`}
              </span>
            </div>
          </Stage>
          {run.error ? (
            <p className="rounded-[14px] bg-down-surface px-4 py-3 text-[15px] font-medium text-down">
              The last try didn't go through, and nothing in that batch moved. Check the rows and
              pay again.
            </p>
          ) : null}
          <div className="flex flex-col rounded-[20px] bg-card p-2">
            {run.rows.map((row) => (
              <RowLine key={row.id} row={row} onToggle={onToggle} />
            ))}
          </div>
          {skipped.length ? (
            <p className="text-detail text-muted-foreground">
              Skipped people aren't paid in this run. Once they're ready, open the run again and
              they'll be in it.
            </p>
          ) : null}
          {short ? (
            <p className="rounded-[14px] bg-warn-surface px-4 py-3 text-[15px] font-medium text-warn">
              Your balance is {money(BigInt(run.total) - BigInt(balance ?? "0"))} short. Add dollars
              or leave someone out.
            </p>
          ) : null}
          {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
          <HoldButton
            label={`Hold to pay ${included.length} ${included.length === 1 ? "person" : "people"} ${money(total)}`}
            ready={included.length > 0 && !short}
            busy={busy}
            onConfirm={onPay}
          />
          <p className="-mt-2 text-center text-detail text-muted-foreground">
            {included.length > 50
              ? `${Math.ceil(included.length / 50)} batches of up to 50. Each one pays everyone in it, or nobody.`
              : "One transaction on NEAR: everyone in it is paid, or nobody is."}
          </p>
        </motion.div>
      ) : run.status === "approved" ? (
        <motion.div key="paying" className="flex flex-col gap-5" {...slide}>
          <div className="flex flex-col items-center gap-1 rounded-[24px] bg-card p-6 text-center">
            <span className="text-detail font-medium text-muted-foreground">
              Paying {run.rows.filter((r) => r.batch).length} people
              {batches > 1 ? ` in ${batches} batches` : ""}
            </span>
            <Figure value={viewDollars(total)} className="text-[56px]" />
          </div>
          <div className="rounded-[20px] bg-secondary p-2">
            <TaskSteps steps={STEPS} current={progress} />
          </div>
        </motion.div>
      ) : run.status === "paid" ? (
        <motion.div key="paid" className="flex flex-col gap-5" {...slide}>
          <Stage className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-medium text-white/85">
                  Paid {paid.length} {paid.length === 1 ? "person" : "people"}
                </span>
                <Figure
                  value={viewDollars(total)}
                  className="text-[56px] text-white sm:text-[72px]"
                />
                <span className="text-[15px] font-medium text-white/85">
                  {run.transactions.length === 1
                    ? "In one transaction on NEAR"
                    : `In ${run.transactions.length} transactions on NEAR`}
                </span>
              </div>
              <SealPress
                delay={0.3}
                onLanded={() => fire("filled", { cue: "stamp", identity: `run:${run.id}` })}
              >
                <span className="grid shrink-0 place-items-center rounded-full bg-white p-2 shadow-object">
                  <BusinessSeal name={business} band="Paid" size={96} />
                </span>
              </SealPress>
            </div>
          </Stage>
          <div className="flex flex-col rounded-[20px] bg-card p-2">
            {run.rows.map((row) => (
              <RowLine key={row.id} row={row} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {run.transactions.map((tx, i) => (
              <Button key={tx.hash} variant="secondary" size="sm" asChild>
                <a href={tx.url} target="_blank" rel="noreferrer">
                  {run.transactions.length > 1 ? `Batch ${i + 1} on NEAR` : "See it on NEAR"}{" "}
                  <ExternalLink />
                </a>
              </Button>
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div key="failed" className="flex flex-col gap-5" {...slide}>
          <ErrorState
            title="This run didn't go through"
            detail={
              paid.length
                ? `${paid.length} were paid. Nothing in the failed batch moved, so no one was paid twice or half.`
                : "Nothing moved. No one was paid, and your balance is as it was."
            }
            stillWorks="Review it and pay again: the batch is drafted fresh."
            onRetry={busy ? undefined : onRetry}
            technical={run.error ?? undefined}
          />
          <div className="flex flex-col rounded-[20px] bg-card p-2">
            {run.rows.map((row) => (
              <RowLine key={row.id} row={row} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

function RowLine({
  row,
  onToggle,
}: {
  row: PayRunRow
  onToggle?: (row: PayRunRow, included: boolean) => void
}) {
  const muted = row.status === "skipped" || row.status === "excluded"
  return (
    <div className="flex items-center gap-3 rounded-[14px] px-3 py-3">
      <CustomerDisc name={row.name} size={40} />
      <span className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/app/people?id=${row.personId}`}
          className={cn(
            "truncate text-[16px] font-semibold underline decoration-current/25 decoration-dotted underline-offset-[3px] hover:decoration-solid",
            muted && "text-text-3",
          )}
        >
          {row.name}
        </Link>
        {row.status === "skipped" ? (
          <span className="truncate text-detail text-warn">{row.skipReason}</span>
        ) : row.accountId ? (
          <span className="flex min-w-0 items-center gap-1.5 text-detail text-muted-foreground">
            {row.destinationKind ? <DestinationMark kind={row.destinationKind} size={14} /> : null}
            <AccountLink accountId={row.accountId} className="text-[12px]" />
          </span>
        ) : null}
      </span>
      <span
        className={
          muted ? "tnum text-[16px] font-semibold text-text-3" : "tnum text-[16px] font-semibold"
        }
      >
        {money(row.amount)}
      </span>
      {row.status === "paid" ? (
        <Link
          href={`/r/slip/${row.id}`}
          className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-up-surface px-3 text-[14px] font-semibold text-up [&_svg]:size-4"
        >
          <FileText /> Payslip
        </Link>
      ) : row.status === "failed" ? (
        <StatusPill tone="down">Not paid</StatusPill>
      ) : onToggle && (row.status === "included" || row.status === "excluded") ? (
        <Switch
          checked={row.status === "included"}
          label={`Pay ${row.name} in this run`}
          onCheckedChange={(next) => onToggle(row, next)}
        />
      ) : row.status === "excluded" ? (
        <StatusPill tone="quiet">Left out</StatusPill>
      ) : row.status === "skipped" ? (
        <StatusPill tone="quiet">Skipped</StatusPill>
      ) : null}
    </div>
  )
}
