"use client"

import type { NetworkId } from "@tegata/config"
// Home: the balance on a stage tile with four actions, the pay address as a sealed card, the latest
// movements as rows that open their receipts, and colour-field first steps that retire as each is done. Separate
// from its data so /dev/flows can show every state.
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  ChevronRight,
  Copy,
  FileText,
  Link2,
  Plus,
  ScanLine,
  UsersRound,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useState } from "react"
import {
  type MovementExtras,
  MovementMark,
  shortAccount,
  subjectOfActivity,
} from "@/components/books/movement-mark"
import { BusinessSeal } from "@/components/brand/seal"
import { AccountLink } from "@/components/kit/account-link"
import { Button, Spinner } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Paper, Stage, StageAction, StageObject } from "@/components/kit/stage"
import { EmptyState, LoadingShape, StatusPill } from "@/components/kit/states"
import { Mark, MarkStack } from "@/components/marks/mark"
import type { TestDollars } from "@/hooks/use-test-dollars"
import type { ActivityItem } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { usdUnits } from "@/lib/fiat"
import { cn } from "@/lib/utils"

const COPIED_MS = 1500
/** USDC base units: below this, Sandbox test dollars are still worth suggesting. */
const ONE_DOLLAR = 1_000_000n

export interface HomeViewProps {
  businessName: string
  accountId: string
  /** The account's network, so its explorer link is right for an implicit (64-hex) account too. */
  network?: NetworkId
  /** USDC base units; null while the live balance is loading. */
  balance: bigint | null
  /** The latest movements; a row may carry how it was paid (`rail`, `assetIn`) for its mark. */
  activity: (ActivityItem & MovementExtras)[] | undefined
  activityError: boolean
  onReceive: () => void
  /** Open the QR scanner (pay a link, an account or an address by scanning it). */
  onScan?: () => void
  onRetryActivity: () => void
  /** Set when this business joined through another's link and the reward is still ahead. */
  invite?: {
    business: string
    received: bigint
    threshold: bigint
    reward: bigint
    qualified: boolean
  } | null
  /** First steps already taken; each retires its tile. Undefined while loading (no tiles flash in and out). */
  steps?: { invoiceSent: boolean; linkMade: boolean; peopleAdded: boolean }
  /** Sandbox only: today's test dollars from the operator. */
  testDollars?: TestDollars
  onAddTestDollars?: () => void
  /** The payday has come and no run has paid it yet. */
  payrollDue?: { payday: string; people: number; total: bigint } | null
  /** What the pots hold, shown under the balance once anything is set aside. */
  pots?: { spendable: bigint; tax: bigint; savings: bigint } | null
}

export function HomeView({
  businessName,
  accountId,
  network,
  balance,
  activity,
  activityError,
  onReceive,
  onScan,
  onRetryActivity,
  testDollars,
  onAddTestDollars,
  invite,
  steps,
  payrollDue,
  pots,
}: HomeViewProps) {
  const [copied, setCopied] = useState(false)
  const reduce = useReducedMotion()
  const copy = async () => {
    await navigator.clipboard.writeText(accountId)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }
  // First steps retire once done: the invoice and link tiles after the first of each, test dollars once the balance
  // can pay something (or while this session's grant is on its way). With none left, Latest takes the full width.
  const wantsTestDollars =
    testDollars !== undefined &&
    onAddTestDollars !== undefined &&
    (testDollars.state !== "idle" || (balance !== null && balance < ONE_DOLLAR))
  const nextTiles = [
    steps && !steps.invoiceSent ? (
      <Tile
        key="invoice"
        field="bg-sakura"
        title="Send your first invoice"
        detail="They pay in dollars; you get the exact amount."
        href="/app/invoices/new"
        icon={<FileText />}
      />
    ) : null,
    steps && !steps.linkMade ? (
      <Tile
        key="link"
        field="bg-sora"
        title="Create your first pay link"
        detail="Anyone can pay it, by email or a NEAR wallet."
        href="/app/links?new=1"
        icon={<Link2 />}
      />
    ) : null,
    steps && !steps.peopleAdded ? (
      <Tile
        key="people"
        field="bg-matcha"
        title="Add your people"
        detail="One approval pays everyone."
        href="/app/people"
        icon={<UsersRound />}
      />
    ) : null,
    wantsTestDollars ? (
      <Tile
        key="test-dollars"
        field="bg-kin"
        title={testDollars.state === "sent" ? "Test dollars added" : "Add test dollars"}
        detail={
          testDollars.state === "sending"
            ? "Sending $5.00…"
            : testDollars.state === "sent"
              ? "$5.00 is in your balance. More tomorrow."
              : testDollars.state === "failed"
                ? (testDollars.error ?? "That didn't work. Try again.")
                : "$5.00 of test USDC, once a day."
        }
        onClick={onAddTestDollars}
        disabled={testDollars.state === "sending" || testDollars.state === "sent"}
        busy={testDollars.state === "sending"}
        icon={testDollars.state === "sent" ? <Check /> : <Plus />}
      />
    ) : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-3">
        <BusinessSeal name={businessName} size={52} tilt={-4} />
        <div className="flex min-w-0 flex-col">
          <h1 className="display truncate text-page-title">{businessName}</h1>
          <AccountLink
            accountId={accountId}
            network={network}
            className="text-detail text-muted-foreground hover:text-foreground"
          />
        </div>
      </header>

      <Stage className="p-6 sm:p-8 lg:min-h-[300px]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <Link
                href="/app/balance"
                className="inline-flex items-center gap-2 self-start text-[15px] font-medium text-white/85 hover:text-white"
              >
                <Mark id="usdc" chain="near" size={22} /> Balance · USDC on NEAR
                <ChevronRight className="size-4" />
              </Link>
              {balance === null ? (
                <span
                  role="status"
                  aria-label="Loading balance"
                  className="my-2 block h-[60px] w-56 animate-skeleton rounded-[14px] bg-white/25 sm:h-[72px]"
                />
              ) : (
                <Figure
                  value={viewDollars(balance)}
                  className="text-[64px] text-white sm:text-[80px]"
                />
              )}
              {pots && pots.tax + pots.savings > 0n ? (
                <Link
                  href="/app/balance"
                  className="tnum flex flex-wrap gap-x-4 gap-y-1 self-start text-[15px] font-medium text-white/85 hover:text-white"
                >
                  <span>Spendable {usdUnits(pots.spendable)}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-pot-tax ring-1 ring-white/60" />
                    Tax {usdUnits(pots.tax)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-pot-savings ring-1 ring-white/60" />
                    Savings {usdUnits(pots.savings)}
                  </span>
                </Link>
              ) : null}
            </div>
            <div className="flex gap-4 sm:gap-6">
              <StageAction label="Get paid" onClick={onReceive} icon={<ArrowDownLeft />} />
              <StageAction label="Send" href="/app/send" icon={<ArrowUpRight />} />
              <StageAction label="Add money" href="/app/balance?add=1" icon={<Plus />} />
              {onScan ? <StageAction label="Scan" onClick={onScan} icon={<ScanLine />} /> : null}
            </div>
          </div>
          <StageObject className="hidden md:block" from={{ y: 20, rotate: 3 }}>
            <Paper className="relative w-[300px] p-5">
              <span className="text-[13px] font-semibold text-paper-text-2">Your pay address</span>
              <div className="mt-2 flex items-center gap-2">
                <Mark id="near" size={24} />
                <AccountLink
                  accountId={accountId}
                  network={network}
                  className="text-[15px] font-medium"
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <MarkStack ids={["usdc", "near"]} size={24} />
                <span className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={copy}
                    className="press inline-flex items-center gap-1 text-[14px] font-semibold text-paper-seal hover:underline [&_svg]:size-3.5"
                  >
                    {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={onReceive}
                    className="press text-[14px] font-semibold text-paper-seal hover:underline"
                  >
                    Show QR
                  </button>
                </span>
              </div>
              <div className="absolute -top-7 -right-7">
                <BusinessSeal name={businessName} size={72} />
              </div>
            </Paper>
          </StageObject>
        </div>
      </Stage>

      {payrollDue ? (
        <Link
          href="/app/payroll"
          className="press-lift flex items-center gap-4 rounded-[20px] bg-kin p-5 text-field-ink"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white [&_svg]:size-6">
            <Banknote />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[17px] font-semibold">Payroll due</span>
            <span className="text-[14px] text-field-ink/70">
              {paydayWord(payrollDue.payday)} · {usdUnits(payrollDue.total)} to {payrollDue.people}{" "}
              {payrollDue.people === 1 ? "person" : "people"}
            </span>
          </span>
          <span className="inline-flex h-10 items-center rounded-full bg-black px-4 text-[15px] font-semibold text-white">
            Review
          </span>
        </Link>
      ) : null}

      {invite ? (
        <Link
          href="/app/refer"
          className="press-lift flex flex-col gap-3 rounded-[20px] bg-sakura p-5 text-field-ink sm:flex-row sm:items-center"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white">
            <BusinessSeal name={invite.business} size={40} tilt={0} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-medium text-field-ink/70">
              Invited by {invite.business}
            </span>
            <span className="display text-[24px] leading-none">
              You both get {usdUnits(invite.reward)}
              {invite.qualified ? " soon" : ""}
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-field-ink/10" aria-hidden>
              <span
                className="block h-full rounded-full bg-black"
                style={{
                  width: `${invite.threshold > 0n ? Math.min(100, Number((invite.received * 100n) / invite.threshold)) : 0}%`,
                }}
              />
            </span>
            <span className="tnum text-[13px] text-field-ink/70">
              {usdUnits(invite.received)} of {usdUnits(invite.threshold)} from customers
            </span>
          </span>
        </Link>
      ) : null}

      <div
        className={cn(
          // minmax(0, …): a long row title truncates instead of widening the column past the screen.
          "grid grid-cols-1 gap-6",
          nextTiles.length > 0 && "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]",
        )}
      >
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-section-title font-semibold">Latest</h2>
            <Link
              href="/app/activity"
              className="text-[15px] font-semibold text-shu-ink hover:underline"
            >
              All activity
            </Link>
          </div>
          {activity === undefined && !activityError ? (
            <div className="rounded-[20px] bg-card p-3">
              <LoadingShape shape="list" />
            </div>
          ) : activityError ? (
            <div className="flex items-center justify-between rounded-[20px] bg-card p-5">
              <span className="text-[15px] text-muted-foreground">
                Couldn't load your activity. Your balance above is live.
              </span>
              <button
                type="button"
                onClick={onRetryActivity}
                className="text-[15px] font-semibold text-shu-ink hover:underline"
              >
                Retry
              </button>
            </div>
          ) : activity && activity.length > 0 ? (
            <div className="flex flex-col rounded-[20px] bg-card p-2">
              {activity.map((item, i) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  business={businessName}
                  index={i}
                  reduce={reduce === true}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              art={<Link2 />}
              field="sora"
              title="Nothing has moved yet"
              detail="Money in and out lands here."
              action={
                <Button variant="shu" size="md" asChild>
                  <Link href="/app/links?new=1">
                    <Link2 /> Create a pay link
                  </Link>
                </Button>
              }
            />
          )}
        </section>

        {nextTiles.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-section-title font-semibold">Get started</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">{nextTiles}</div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

/** The same words as Activity: what the person would say, never the system's state. */
const STATUS_WORD: Record<ActivityItem["status"], string> = {
  drafted: "Not sent",
  signed: "On its way",
  sent: "On its way",
  success: "Sent",
  failed: "Didn't go through",
  unknown: "On its way",
  expired: "Didn't go through",
  awaiting: "Waiting",
  detected: "On its way",
  settling: "On its way",
  succeeded: "Paid",
  refunded: "Refunded",
}

const DONE: ActivityItem["status"][] = ["success", "succeeded"]
const BAD: ActivityItem["status"][] = ["failed", "expired", "refunded"]

/** One movement: what happened, with whom, when, and the signed amount. It opens its receipt, never NEAR first. */
function ActivityRow({
  item,
  business,
  index,
  reduce,
}: {
  item: ActivityItem & MovementExtras
  business: string
  index: number
  reduce: boolean
}) {
  // Sends and payments in name an account (shortened when it's a long one); the others name a business.
  const who =
    item.kind === "send" || item.kind === "received"
      ? shortAccount(item.counterparty)
      : item.counterparty
  const incoming = item.kind === "received" || item.kind === "reward" || item.kind === "payslip"
  const headline =
    item.kind === "payroll"
      ? "Payroll"
      : item.kind === "payslip"
        ? `Pay from ${who}`
        : item.kind === "reward"
          ? (item.title ?? "Referral reward")
          : item.kind === "received"
            ? `${item.title ?? "Pay link"} · paid`
            : item.kind === "paid"
              ? `Paid ${who}`
              : `Sent to ${who}`
  const detail =
    item.kind === "payroll" && item.title
      ? `${item.title} · ${timeAgo(item.at)}`
      : item.kind === "received"
        ? `From ${who} · ${timeAgo(item.at)}`
        : item.kind === "paid" && item.title
          ? `${item.title} · ${timeAgo(item.at)}`
          : timeAgo(item.at)
  const receipt = item.receiptUrl
  const body = (
    <>
      <MovementMark movement={subjectOfActivity(item)} business={business} size={40} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[16px] font-semibold">{headline}</span>
        <span className="truncate text-detail text-muted-foreground">{detail}</span>
      </span>
      {DONE.includes(item.status) ? null : (
        <StatusPill tone={BAD.includes(item.status) ? "down" : "wait"}>
          {STATUS_WORD[item.status]}
        </StatusPill>
      )}
      <span className={cn("tnum text-[16px] font-semibold", incoming && "text-up")}>
        {incoming ? "+" : "−"}
        {usdUnits(item.amount)}
      </span>
    </>
  )
  const cls = "press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
  const motionProps = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.04, duration: 0.32, ease: [0.2, 0.8, 0.2, 1] as const },
  }
  return (
    <motion.div {...motionProps}>
      {receipt ? (
        <Link href={receipt} className={cls}>
          {body}
          <ChevronRight className="size-4 shrink-0 text-text-3" />
        </Link>
      ) : (
        <div className={cn(cls, "cursor-default hover:bg-transparent active:scale-100")}>
          {body}
        </div>
      )}
    </motion.div>
  )
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return "Just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function Tile({
  field,
  title,
  detail,
  icon,
  onClick,
  href,
  external,
  disabled,
  busy,
}: {
  field: string
  title: string
  detail: string
  icon: React.ReactNode
  onClick?: () => void
  href?: string
  external?: boolean
  disabled?: boolean
  busy?: boolean
}) {
  const body = (
    <>
      <span className="grid size-11 place-items-center rounded-full bg-field-ink/10 [&_svg]:size-5">
        {busy ? <Spinner /> : icon}
      </span>
      <span className="flex flex-col gap-1">
        <span className="display text-[24px] leading-none">{title}</span>
        <span className="text-[14px] text-field-ink/70">{detail}</span>
      </span>
    </>
  )
  const cls = cn(
    "press-lift flex min-h-36 flex-col justify-between gap-4 rounded-[20px] p-5 text-left text-field-ink",
    field,
  )
  if (href)
    return external ? (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {body}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {body}
      </Link>
    )
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={cn(cls, "disabled:cursor-default")}
    >
      {body}
    </button>
  )
}

/** "Payday was Fri 28 Nov" or "Payday is today": a payday is a calendar date, read as one. */
function paydayWord(iso: string): string {
  const today = new Date().toISOString().slice(0, 10)
  if (iso === today) return "Payday is today"
  return `Payday was ${new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`
}
