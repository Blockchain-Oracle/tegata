"use client"

// Balance: what you hold (USDC on NEAR plus what's set aside in autopilot), adding and moving money, and
// the books checked against NEAR: every USDC transfer on the account, matched by transaction to what Tegata recorded.
// A transfer that came or went outside Tegata is listed, never matched automatically.
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Landmark,
  Plus,
} from "lucide-react"

import { shortAccount } from "@/components/books/movement-mark"
import { AccountLink, accountUrl } from "@/components/kit/account-link"
import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { SandboxPill } from "@/components/kit/sandbox-pill"
import { Stage, StageAction } from "@/components/kit/stage"
import { ErrorState, LoadingShape } from "@/components/kit/states"
import { Mark, MarkStack } from "@/components/marks/mark"
import type { Reconciliation } from "@/lib/client/types"
import { usdUnits } from "@/lib/fiat"

export function BalanceView({
  balance,
  setAside,
  accountId,
  reconciliation,
  reconcileError,
  onReconcile,
  onAddMoney,
  live = false,
}: {
  /** USDC base units on NEAR, or null while loading. */
  balance: string | null
  /** Available + reserved in the autopilot contract. */
  setAside: string
  accountId: string
  reconciliation: Reconciliation | undefined
  reconcileError: string | null
  onReconcile: () => void
  /** Open the Add money chooser: your pay address, another chain, test dollars. */
  onAddMoney: () => void
  /** Live (mainnet): moving out reaches any chain through NEAR Intents. */
  live?: boolean
}) {
  const network = live ? "mainnet" : "testnet"
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
              <span
                role="status"
                aria-label="Loading balance"
                className="my-2 block h-[56px] w-56 animate-skeleton rounded-[14px] bg-white/25 sm:h-[68px]"
              />
            ) : (
              <Figure value={viewDollars(hold)} className="text-[56px] text-white sm:text-[72px]" />
            )}
            {balance === null ? (
              <span className="block h-4 w-44 animate-skeleton rounded-full bg-white/25" />
            ) : (
              <span className="tnum text-[15px] font-medium text-white/85">
                {usdUnits(balance)} in your balance
                {BigInt(setAside) > 0n ? ` · ${usdUnits(setAside)} in autopilot` : ""}
              </span>
            )}
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <AccountLink
                accountId={accountId}
                network={network}
                className="text-[13px] text-white/80 hover:text-white"
              />
              {live ? null : (
                <SandboxPill tone="stage" className="py-0.5 text-[12px]">
                  Sandbox · other chains in Live
                </SandboxPill>
              )}
            </span>
          </div>
          <div className="flex gap-4 sm:gap-6">
            <StageAction label="Add money" icon={<Plus />} onClick={onAddMoney} />
            <StageAction
              label="Move out"
              icon={<ArrowUpRight />}
              href={live ? "/app/send?mode=chain" : "/app/send"}
            />
            <StageAction label="To a bank" icon={<Landmark />} href="/app/bank" />
            {BigInt(setAside) > 0n ? (
              <StageAction label="Autopilot" icon={<CalendarClock />} href="/app/payroll" />
            ) : null}
          </div>
        </div>
      </Stage>

      <section className="flex flex-col gap-3 rounded-[24px] bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold">
            <Mark id="near" size={24} /> Books against NEAR
          </span>
          <span className="flex items-center gap-1.5">
            {accountId ? (
              <Button variant="ghost" size="iconSm" asChild>
                <a
                  href={accountUrl(accountId, network)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="This account's transfers on NearBlocks"
                  title="On NearBlocks"
                >
                  <ExternalLink />
                </a>
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={onReconcile}>
              Check again
            </Button>
          </span>
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
          <div className="flex items-center gap-3 rounded-[16px] bg-up-surface px-4 py-3 text-up">
            <CheckCircle2 className="size-6 shrink-0" />
            <span className="flex flex-col">
              <span className="text-[16px] font-semibold">
                {reconciliation.checked === 0 ? "No USDC transfers yet" : "Books match NEAR"}
              </span>
              {reconciliation.checked > 0 ? (
                <span className="text-detail font-medium">
                  {reconciliation.checked} {reconciliation.checked === 1 ? "transfer" : "transfers"}{" "}
                  checked
                </span>
              ) : null}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="px-1 text-[15px] font-semibold">
              {reconciliation.outside.length}{" "}
              {reconciliation.outside.length === 1 ? "transfer" : "transfers"} outside Tegata
              <span className="font-medium text-muted-foreground">
                {" "}
                · of {reconciliation.checked}
              </span>
            </span>
            <div className="flex flex-col rounded-[16px] bg-secondary p-1.5">
              {withKeys(reconciliation.outside).map(({ item: t, key }) => {
                const delta = BigInt(t.delta)
                return (
                  <a
                    key={key}
                    href={t.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="press flex items-center gap-3 rounded-[12px] px-2 py-2.5 hover:bg-plate-pressed"
                  >
                    <Mark id="near" size={32} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-semibold">
                        {delta > 0n ? "Arrived outside Tegata" : "Left outside Tegata"}
                      </span>
                      <span className="truncate text-detail text-muted-foreground">
                        {delta > 0n ? "From " : "To "}
                        <span className="font-mono">{shortAccount(t.other)}</span> ·{" "}
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
                      {usdUnits(delta > 0n ? delta : -delta)}
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-text-3" />
                  </a>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

/** One transaction can move the same amount twice (a payroll run paying two people the same): number the repeats. */
function withKeys<T extends { txHash: string; delta: string }>(items: readonly T[]) {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const base = `${item.txHash}:${item.delta}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return { item, key: n ? `${base}:${n}` : base }
  })
}
