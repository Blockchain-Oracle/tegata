"use client"

// Invoices (plan 6.8 J; Kitchen.co and Square lists): what customers owe on the stage (one hero figure, two facts),
// status tabs with counts, a search, and one row per invoice. Empty: a matcha tile that names the next action.
import { ChevronRight, FileText, Plus, Search } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Segmented } from "@/components/kit/segmented"
import { Stage } from "@/components/kit/stage"
import { EmptyState, ErrorState, LoadingShape } from "@/components/kit/states"
import type { InvoiceRow } from "@/lib/client/types"
import { usdUnits } from "@/lib/fiat"
import { cn } from "@/lib/utils"

import { CustomerDisc } from "./customer-picker"
import { dueText, InvoiceStatusPill } from "./status"

type Tab = "all" | "unpaid" | "overdue" | "paid" | "drafts"

const UNPAID = new Set(["sent", "viewed", "partly_paid", "overdue"])
const MONTH_MS = 30 * 86_400_000

const inTab = (row: InvoiceRow, tab: Tab) =>
  tab === "all"
    ? true
    : tab === "unpaid"
      ? UNPAID.has(row.status)
      : tab === "overdue"
        ? row.status === "overdue"
        : tab === "paid"
          ? row.status === "paid"
          : row.status === "draft"

export const invoiceLabel = (number: number | null) =>
  number ? `INV-${String(number).padStart(4, "0")}` : "Draft"

export function InvoicesView({
  invoices,
  error,
  onRetry,
  today,
  initialQuery = "",
}: {
  invoices: InvoiceRow[] | undefined
  error: boolean
  onRetry: () => void
  today: string
  /** The search, filled in from `?q=`. */
  initialQuery?: string
}) {
  const reduce = useReducedMotion()
  const [tab, setTab] = useState<Tab>("all")
  const [query, setQuery] = useState(initialQuery)

  const facts = useMemo(() => {
    const rows = invoices ?? []
    const sum = (list: InvoiceRow[], key: "remaining" | "total") =>
      list.reduce((total, row) => total + BigInt(row[key]), 0n)
    const now = Date.now()
    return {
      outstanding: sum(
        rows.filter((r) => UNPAID.has(r.status)),
        "remaining",
      ),
      overdue: sum(
        rows.filter((r) => r.status === "overdue"),
        "remaining",
      ),
      paid30: sum(
        rows.filter(
          (r) => r.status === "paid" && r.paidAt && now - Date.parse(r.paidAt) < MONTH_MS,
        ),
        "total",
      ),
      counts: Object.fromEntries(
        (["all", "unpaid", "overdue", "paid", "drafts"] as Tab[]).map((t) => [
          t,
          rows.filter((r) => inTab(r, t)).length,
        ]),
      ) as Record<Tab, number>,
    }
  }, [invoices])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (invoices ?? []).filter(
      (row) =>
        inTab(row, tab) &&
        (!q ||
          (row.customer ?? "").toLowerCase().includes(q) ||
          invoiceLabel(row.number).toLowerCase().includes(q) ||
          viewDollars(row.total).toFixed(2).includes(q) ||
          usdUnits(row.total).includes(q)),
    )
  }, [invoices, tab, query])

  const label = (t: Tab, text: string) => (facts.counts[t] ? `${text} ${facts.counts[t]}` : text)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="display text-page-title">Invoices</h1>
        <Button variant="shu" size="md" asChild>
          <Link href="/app/invoices/new">
            <Plus /> New invoice
          </Link>
        </Button>
      </header>

      {error ? (
        <ErrorState
          title="Couldn't load your invoices"
          detail="Links you've sent still work for your customers."
          onRetry={onRetry}
        />
      ) : invoices === undefined ? (
        <div className="flex flex-col gap-4">
          <LoadingShape shape="card" className="h-[170px] rounded-[24px]" />
          <div className="rounded-[20px] bg-card p-3">
            <LoadingShape shape="list" />
          </div>
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          art={<FileText />}
          field="matcha"
          title="No invoices yet"
          detail="Bill a customer in a minute. They pay in dollars from any wallet; you get exact USDC."
          action={
            <Button variant="shu" asChild>
              <Link href="/app/invoices/new">
                <Plus /> New invoice
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <Stage className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-medium text-white/85">Customers owe you</span>
                <Figure
                  value={viewDollars(facts.outstanding)}
                  className="text-[56px] text-white sm:text-[72px]"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col rounded-[16px] bg-white/18 px-4 py-3">
                  <span className="text-[13px] font-medium text-white/85">Overdue</span>
                  <Figure value={viewDollars(facts.overdue)} className="text-[24px] text-white" />
                </div>
                <div className="flex flex-col rounded-[16px] bg-white/18 px-4 py-3">
                  <span className="text-[13px] font-medium text-white/85">Paid, last 30 days</span>
                  <Figure value={viewDollars(facts.paid30)} className="text-[24px] text-white" />
                </div>
              </div>
            </div>
          </Stage>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="-mx-1 overflow-x-auto px-1">
              <Segmented
                label="Show"
                value={tab}
                onValueChange={(v) => setTab(v as Tab)}
                options={[
                  { value: "all", label: "All" },
                  { value: "unpaid", label: label("unpaid", "Unpaid") },
                  { value: "overdue", label: label("overdue", "Overdue") },
                  { value: "paid", label: label("paid", "Paid") },
                  { value: "drafts", label: label("drafts", "Drafts") },
                ]}
              />
            </div>
            <label className="flex h-11 items-center gap-2 rounded-[12px] bg-card px-3 sm:w-64">
              <Search className="size-4 text-text-3" />
              <span className="sr-only">Search invoices</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Customer, number, amount"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-3"
              />
            </label>
          </div>

          {shown.length === 0 ? (
            // Every empty view names its next action (R6).
            <div className="flex flex-col items-center gap-4 rounded-[20px] bg-card px-5 py-10 text-center">
              <span className="text-[15px] text-muted-foreground">
                {query
                  ? "Nothing matches that search."
                  : tab === "overdue"
                    ? "Nothing overdue."
                    : tab === "drafts"
                      ? "No drafts."
                      : tab === "paid"
                        ? "No paid invoices yet."
                        : "No unpaid invoices."}
              </span>
              {query ? (
                <Button variant="secondary" size="md" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              ) : (
                <Button variant="secondary" size="md" asChild>
                  <Link href="/app/invoices/new">
                    <Plus /> New invoice
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col rounded-[20px] bg-card p-2">
              {shown.map((row, i) => (
                <motion.div
                  key={row.id}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: Math.min(i, 8) * 0.04,
                    duration: 0.32,
                    ease: [0.2, 0.8, 0.2, 1],
                  }}
                >
                  <Link
                    href={
                      row.status === "draft"
                        ? `/app/invoices/${row.id}/edit`
                        : `/app/invoices/${row.id}`
                    }
                    className="press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
                  >
                    <CustomerDisc name={row.customer ?? "?"} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[16px] font-semibold">
                        {row.customer ?? "No customer yet"}
                      </span>
                      <span className="truncate text-detail text-muted-foreground">
                        <span className="font-mono">{invoiceLabel(row.number)}</span> ·{" "}
                        <span className={cn(row.status === "overdue" && "font-medium text-down")}>
                          {dueText(row.status, row.dueDate, today, row.paidAt)}
                        </span>
                      </span>
                    </span>
                    <InvoiceStatusPill status={row.status} className="max-sm:hidden" />
                    <span className="flex flex-col items-end">
                      <span className="tnum text-[16px] font-semibold">{usdUnits(row.total)}</span>
                      {row.status === "partly_paid" ||
                      (row.status === "overdue" && BigInt(row.paid) > 0n) ? (
                        <span className="tnum text-[12px] text-muted-foreground">
                          {usdUnits(row.remaining)} left
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-text-3" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
