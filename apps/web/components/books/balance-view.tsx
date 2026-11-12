"use client"

// Balance (plan 6.8 W): what you hold (USDC on NEAR plus what's set aside in autopilot), adding and moving money, and
// the books checked against NEAR: every USDC transfer on the account, matched by transaction to what Tegata recorded.
// A transfer that came or went outside Tegata is listed, never matched automatically.
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Plus,
  Scale,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Stage, StageAction } from "@/components/kit/stage"
import { ErrorState, LoadingShape } from "@/components/kit/states"
import { MarkStack } from "@/components/marks/mark"
import { money } from "@/components/payroll/payroll-view"
import type { Reconciliation } from "@/lib/client/types"

export function BalanceView({
  balance,
  setAside,
  accountId,
  reconciliation,
  reconcileError,
  onReconcile,
  onReceive,
  onTestDollars,
}: {
  /** USDC base units on NEAR, or null while loading. */
  balance: string | null
  /** Available + reserved in the autopilot contract. */
  setAside: string
  accountId: string
  reconciliation: Reconciliation | undefined
  reconcileError: string | null
  onReconcile: () => void
  onReceive: () => void
  onTestDollars?: () => void
}) {
  const hold = (balance === null ? 0n : BigInt(balance)) + BigInt(setAside)
  return (
    <div className="flex flex-col gap-6">
      <h1 className="display text-page-title">Balance</h1>
      <Stage className="p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-2 text-[15px] font-medium text-white/85">
              <MarkStack ids={["usdc", "near"]} size={22} /> You hold
            </span>
            {balance === null ? (
              <LoadingShape shape="row" className="h-16 w-56" />
            ) : (
              <Figure value={viewDollars(hold)} className="text-[56px] text-white sm:text-[72px]" />
            )}
            <span className="text-[15px] font-medium text-white/85">
              {balance === null ? "Reading NEAR…" : `${money(balance)} in your balance`}
              {BigInt(setAside) > 0n ? ` · ${money(setAside)} set aside in autopilot` : ""}
            </span>
            <span className="font-mono text-[13px] text-white/75">{accountId}</span>
          </div>
          <div className="flex gap-6">
            <StageAction label="Add" icon={<ArrowDownLeft />} onClick={onReceive} />
            <StageAction label="Move out" icon={<ArrowUpRight />} href="/app/send" />
            {onTestDollars ? (
              <StageAction label="Test $" icon={<Plus />} onClick={onTestDollars} />
            ) : null}
            {BigInt(setAside) > 0n ? (
              <StageAction label="Autopilot" icon={<CalendarClock />} href="/app/payroll" />
            ) : null}
          </div>
        </div>
      </Stage>
      <p className="text-detail text-muted-foreground">
        Adding from or moving to another chain comes with Live: NEAR Intents has no testnet.
      </p>

      <section className="flex flex-col gap-3 rounded-[24px] bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold">
            <Scale className="size-5" /> Books against NEAR
          </span>
          <Button variant="secondary" size="sm" onClick={onReconcile}>
            Check again
          </Button>
        </div>
        {reconcileError ? (
          <ErrorState
            title="Couldn't read the account's transfers"
            detail={reconcileError}
            stillWorks="Your balance above is read from NEAR directly."
            onRetry={onReconcile}
          />
        ) : !reconciliation ? (
          <LoadingShape shape="list" />
        ) : reconciliation.outside.length === 0 ? (
          <p className="inline-flex items-center gap-2 rounded-[14px] bg-up-surface px-4 py-3 text-[15px] font-semibold text-up">
            <CheckCircle2 className="size-5" /> Books match NEAR: {reconciliation.checked} transfers
            checked, every one recorded by Tegata.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[15px] text-muted-foreground">
              {reconciliation.outside.length} of {reconciliation.checked} USDC transfers on this
              account weren't made or recorded by Tegata. They're in your balance; they aren't
              matched to anything automatically.
            </p>
            <div className="flex flex-col rounded-[16px] bg-secondary p-1.5">
              {reconciliation.outside.map((t) => {
                const delta = BigInt(t.delta)
                return (
                  <a
                    key={`${t.txHash}:${t.delta}`}
                    href={t.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="press flex items-center gap-3 rounded-[12px] px-2 py-2.5 hover:bg-plate-pressed"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-semibold">
                        {delta > 0n ? "Arrived outside Tegata" : "Left outside Tegata"}
                      </span>
                      <span className="truncate font-mono text-[12px] text-muted-foreground">
                        {delta > 0n ? "from" : "to"} {t.other} ·{" "}
                        {new Date(t.at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </span>
                    <span
                      className={delta > 0n ? "tnum font-semibold text-up" : "tnum font-semibold"}
                    >
                      {delta > 0n ? "+" : "−"}
                      {money(delta > 0n ? delta : -delta)}
                    </span>
                    <ExternalLink className="size-4 text-text-3" />
                  </a>
                )
              })}
            </div>
          </div>
        )}
        <p className="text-detail text-muted-foreground">
          Transfers read from <Link href="https://testnet.nearblocks.io">NearBlocks</Link>, matched
          by transaction.
        </p>
      </section>
    </div>
  )
}
