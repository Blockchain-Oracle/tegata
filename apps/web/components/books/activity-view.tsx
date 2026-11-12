"use client"

// Activity (plan 6.8 U): one month of every movement, money in and out on the stage, filters and search, rows grouped
// by day that each open their object, and the month's CSV and statement. A received payment can be refunded from its
// row. Separate from its data so /dev/flows can show every state.
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  Gift,
  Receipt,
  RotateCcw,
  Search,
  Sparkles,
  Undo2,
} from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Stage } from "@/components/kit/stage"
import { EmptyState, ErrorState, LoadingShape, StatusPill } from "@/components/kit/states"
import { money } from "@/components/payroll/payroll-view"
import type { BooksMonth, MovementKind, MovementView } from "@/lib/client/types"
import { cn } from "@/lib/utils"

export type ActivityFilter = "all" | "in" | "out" | "payroll" | "rewards" | "refunds"

const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in", label: "Money in" },
  { value: "out", label: "Money out" },
  { value: "payroll", label: "Payroll" },
  { value: "rewards", label: "Rewards" },
  { value: "refunds", label: "Refunds" },
]

const ICON: Record<MovementKind, { icon: React.ReactNode; field: string }> = {
  payment_in: { icon: <ArrowDownLeft />, field: "bg-matcha" },
  payment_out: { icon: <Receipt />, field: "bg-sora" },
  send: { icon: <ArrowUpRight />, field: "bg-sora" },
  refund: { icon: <Undo2 />, field: "bg-sakura" },
  reward: { icon: <Gift />, field: "bg-kin" },
  test_dollars: { icon: <Sparkles />, field: "bg-kin" },
  payroll: { icon: <Banknote />, field: "bg-sakura" },
  payslip: { icon: <Banknote />, field: "bg-matcha" },
  autopilot_set_aside: { icon: <CalendarClock />, field: "bg-sora" },
  autopilot_back: { icon: <CalendarClock />, field: "bg-sora" },
}

export function matches(m: MovementView, filter: ActivityFilter, query: string): boolean {
  const ok =
    filter === "all" ||
    (filter === "in" && m.direction === "in") ||
    (filter === "out" && m.direction === "out") ||
    (filter === "payroll" && (m.kind === "payroll" || m.kind === "payslip")) ||
    (filter === "rewards" && m.kind === "reward") ||
    (filter === "refunds" && (m.kind === "refund" || BigInt(m.refunded) > 0n))
  if (!ok) return false
  const q = query.trim().toLowerCase().replace(/^\$/, "")
  if (!q) return true
  return [
    m.title,
    m.counterparty ?? "",
    m.counterpartyAccount ?? "",
    viewDollars(m.amount).toFixed(2),
  ].some((v) => v.toLowerCase().includes(q))
}

export function ActivityView({
  data,
  error,
  onRetry,
  onPrev,
  onNext,
  canNext,
  filter,
  onFilter,
  query,
  onQuery,
  exporting,
  onExport,
  onRefund,
}: {
  data: BooksMonth | undefined
  error: boolean
  onRetry: () => void
  onPrev: () => void
  onNext: () => void
  canNext: boolean
  filter: ActivityFilter
  onFilter: (filter: ActivityFilter) => void
  query: string
  onQuery: (query: string) => void
  exporting: "csv" | "pdf" | null
  onExport: (kind: "csv" | "pdf") => void
  onRefund: (movement: MovementView) => void
}) {
  const shown = useMemo(
    () => (data?.movements ?? []).filter((m) => matches(m, filter, query)),
    [data, filter, query],
  )
  const days = useMemo(() => {
    const groups = new Map<string, MovementView[]>()
    for (const m of shown) {
      const key = new Date(m.at).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: data?.timezone,
      })
      groups.set(key, [...(groups.get(key) ?? []), m])
    }
    return [...groups.entries()]
  }, [shown, data?.timezone])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-page-title">Activity</h1>
        <div className="flex items-center gap-1 rounded-full bg-card p-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={onPrev}
            className="press grid size-9 place-items-center rounded-full hover:bg-secondary"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[8.5rem] text-center text-[15px] font-semibold">
            {data?.label ?? "…"}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={onNext}
            disabled={!canNext}
            className="press grid size-9 place-items-center rounded-full hover:bg-secondary disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>

      {error ? (
        <ErrorState
          title="Couldn't load this month"
          detail="Your money is where it was."
          onRetry={onRetry}
        />
      ) : !data ? (
        <div className="flex flex-col gap-4">
          <LoadingShape shape="card" className="h-[150px] rounded-[24px]" />
          <div className="rounded-[20px] bg-card p-3">
            <LoadingShape shape="list" />
          </div>
        </div>
      ) : (
        <>
          <Stage className="p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-medium text-white/85">Money in</span>
                  <Figure
                    value={viewDollars(data.moneyIn)}
                    className="text-[40px] text-white sm:text-[56px]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-medium text-white/85">Money out</span>
                  <Figure
                    value={viewDollars(data.moneyOut)}
                    className="text-[40px] text-white sm:text-[56px]"
                  />
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <span className="text-[15px] font-medium text-white/85">
                  Net {BigInt(data.net) < 0n ? "−" : "+"}
                  {money(BigInt(data.net) < 0n ? -BigInt(data.net) : BigInt(data.net))}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="paper"
                    size="sm"
                    busy={exporting === "csv"}
                    onClick={() => onExport("csv")}
                  >
                    <FileSpreadsheet /> CSV
                  </Button>
                  <Button
                    variant="paper"
                    size="sm"
                    busy={exporting === "pdf"}
                    onClick={() => onExport("pdf")}
                  >
                    <FileDown /> Statement
                  </Button>
                </div>
              </div>
            </div>
          </Stage>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">Show</legend>
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => onFilter(f.value)}
                  className={cn(
                    "press h-9 rounded-full px-3.5 text-[14px] font-semibold",
                    filter === f.value
                      ? "bg-foreground text-background"
                      : "bg-card hover:bg-secondary",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </fieldset>
            <label className="flex h-10 items-center gap-2 rounded-[12px] bg-card px-3 sm:w-64">
              <Search className="size-4 text-text-3" />
              <span className="sr-only">Search this month</span>
              <input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Name, account or amount"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-3"
              />
            </label>
          </div>

          {data.movements.length === 0 ? (
            <EmptyState
              art={<Receipt />}
              field="sora"
              title={`Nothing moved in ${data.label.split(" ")[0]}`}
              detail="Payments, payroll, sends and rewards show up here as they happen."
            />
          ) : shown.length === 0 ? (
            <p className="rounded-[20px] bg-card px-4 py-8 text-center text-[15px] text-muted-foreground">
              Nothing matches. Try another filter or search.
            </p>
          ) : (
            days.map(([day, list]) => (
              <section key={day} className="flex flex-col gap-1.5">
                <h2 className="px-1 text-detail font-semibold text-muted-foreground">{day}</h2>
                <div className="flex flex-col rounded-[20px] bg-card p-2">
                  {list.map((m) => (
                    <Row
                      key={`${m.kind}:${m.id}`}
                      m={m}
                      timezone={data.timezone}
                      onRefund={onRefund}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}

function Row({
  m,
  timezone,
  onRefund,
}: {
  m: MovementView
  timezone: string
  onRefund: (m: MovementView) => void
}) {
  const time = new Date(m.at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  })
  const refunded = BigInt(m.refunded)
  const body = (
    <>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full text-black [&_svg]:size-[18px]",
          ICON[m.kind].field,
        )}
      >
        {ICON[m.kind].icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{m.title}</span>
        <span className="truncate text-detail text-muted-foreground">
          {[m.counterparty, m.counterpartyAccount, time].filter(Boolean).join(" · ")}
          {refunded > 0n ? ` · refunded ${money(refunded)}` : ""}
        </span>
      </span>
      {m.status !== "done" ? (
        <StatusPill tone={m.status === "failed" ? "down" : "wait"}>
          {m.status === "failed" ? "Didn't go through" : "On its way"}
        </StatusPill>
      ) : null}
      <span
        className={cn(
          "tnum text-[15px] font-semibold",
          m.direction === "in" && "text-up",
          !m.counted && "text-text-3",
        )}
      >
        {m.direction === "in" ? "+" : "−"}
        {money(m.amount)}
      </span>
    </>
  )
  const cls =
    "press flex min-w-0 flex-1 items-center gap-3 rounded-[14px] px-2 py-2.5 hover:bg-secondary"
  return (
    <div className="flex items-center gap-1">
      {m.url ? (
        <Link href={m.url} className={cls}>
          {body}
        </Link>
      ) : m.explorerUrl ? (
        <a href={m.explorerUrl} target="_blank" rel="noreferrer" className={cls}>
          {body}
        </a>
      ) : (
        <div className={cls}>{body}</div>
      )}
      {m.refundable ? (
        <button
          type="button"
          aria-label={`Refund ${m.title}`}
          onClick={() => onRefund(m)}
          className="press grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <RotateCcw className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
