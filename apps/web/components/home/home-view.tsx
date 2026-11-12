"use client"

// Home (plan 6.8 C): the balance on a stage tile with four actions, the pay address as a sealed card, the latest
// movements as rows with real marks, and colour-field first steps for a new account. Separate from its data so
// /dev/flows can show every state.
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Plus,
  Send,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useState } from "react"

import { BusinessSeal } from "@/components/brand/seal"
import { Spinner } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Paper, Stage, StageAction, StageObject } from "@/components/kit/stage"
import { LoadingShape, StatusPill } from "@/components/kit/states"
import { Mark, MarkStack } from "@/components/marks/mark"
import type { TestDollars } from "@/hooks/use-test-dollars"
import type { ActivityItem } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

const COPIED_MS = 1500

export interface HomeViewProps {
  businessName: string
  accountId: string
  /** USDC base units; null while the live balance is loading. */
  balance: bigint | null
  explorerUrl: string
  activity: ActivityItem[] | undefined
  activityError: boolean
  onReceive: () => void
  onRetryActivity: () => void
  /** Sandbox only: today's test dollars from the operator. */
  testDollars?: TestDollars
  onAddTestDollars?: () => void
}

export function HomeView({
  businessName,
  accountId,
  balance,
  explorerUrl,
  activity,
  activityError,
  onReceive,
  onRetryActivity,
  testDollars,
  onAddTestDollars,
}: HomeViewProps) {
  const [copied, setCopied] = useState(false)
  const reduce = useReducedMotion()
  const copy = async () => {
    await navigator.clipboard.writeText(accountId)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }
  const fresh = balance === 0n && (activity?.length ?? 0) === 0
  const funded = balance !== null && balance > 0n

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-3">
        <BusinessSeal name={businessName} size={52} tilt={-4} />
        <div className="flex min-w-0 flex-col">
          <h1 className="display truncate text-page-title">{businessName}</h1>
          <span className="truncate font-mono text-detail text-muted-foreground">{accountId}</span>
        </div>
      </header>

      <Stage className="p-6 sm:p-8 lg:min-h-[300px]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 text-[15px] font-medium text-white/85">
                <Mark id="usdc" chain="near" size={22} /> Balance · USDC on NEAR
              </span>
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
            </div>
            <div className="flex gap-4 sm:gap-6">
              <StageAction label="Get paid" onClick={onReceive} icon={<ArrowDownLeft />} />
              <StageAction label="Send" href="/app/send" icon={<ArrowUpRight />} />
              <StageAction
                label={copied ? "Copied" : "Copy"}
                onClick={copy}
                icon={copied ? <Check /> : <Copy />}
              />
              <StageAction label="On NEAR" href={explorerUrl} external icon={<ExternalLink />} />
            </div>
          </div>
          <StageObject className="hidden md:block" from={{ y: 20, rotate: 3 }}>
            <Paper className="relative w-[300px] p-5">
              <span className="text-[13px] font-semibold text-[#666]">Your pay address</span>
              <div className="mt-2 flex items-center gap-2">
                <Mark id="near" size={24} />
                <span className="truncate font-mono text-[15px] font-medium">{accountId}</span>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <MarkStack ids={["usdc", "near"]} size={24} />
                <button
                  type="button"
                  onClick={onReceive}
                  className="press text-[14px] font-semibold text-[#B23700] hover:underline"
                >
                  Show QR
                </button>
              </div>
              <div className="absolute -top-7 -right-7">
                <BusinessSeal name={businessName} size={72} />
              </div>
            </Paper>
          </StageObject>
        </div>
      </Stage>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold">Latest</h2>
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
                <ActivityRow key={item.id} item={item} index={i} reduce={reduce === true} />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] bg-card px-5 py-8 text-center text-[15px] text-muted-foreground">
              Payments you send and receive show up here.
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold">{fresh ? "Get started" : "Next"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Tile
              field="bg-sakura"
              title={fresh ? "Send your first invoice" : "Send an invoice"}
              detail="Bill a customer. They pay in dollars from any wallet; you get exact USDC."
              href="/app/invoices/new"
              icon={<FileText />}
            />
            <Tile
              field="bg-sora"
              title={fresh ? "Create your first pay link" : "Create a pay link"}
              detail="One link anyone can pay, from an email sign-in or a NEAR wallet."
              href="/app/links?new=1"
              icon={<Link2 />}
            />
            {testDollars && onAddTestDollars ? (
              <Tile
                field="bg-kin"
                title={testDollars.state === "sent" ? "Test dollars added" : "Add test dollars"}
                detail={
                  testDollars.state === "sending"
                    ? "Sending $5.00 from the Sandbox stash…"
                    : testDollars.state === "sent"
                      ? "$5.00 of test USDC is in your balance. More tomorrow."
                      : testDollars.state === "failed"
                        ? (testDollars.error ?? "That didn't work. Try again.")
                        : "$5.00 of test USDC, so you can try paying a link. Once a day."
                }
                onClick={onAddTestDollars}
                disabled={testDollars.state === "sending" || testDollars.state === "sent"}
                busy={testDollars.state === "sending"}
                icon={testDollars.state === "sent" ? <Check /> : <Plus />}
              />
            ) : null}
            {funded ? (
              <Tile
                field="bg-matcha"
                title="Send dollars"
                detail="To any NEAR account. No fees, no gas."
                href="/app/send"
                icon={<Send />}
              />
            ) : (
              <Tile
                field="bg-matcha"
                title="See your account on NEAR"
                detail="Created and registered for USDC by Tegata."
                href={explorerUrl}
                external
                icon={<ExternalLink />}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

const STATUS_WORD: Record<ActivityItem["status"], string> = {
  drafted: "Not approved",
  signed: "Sending",
  sent: "Sending",
  success: "Sent",
  failed: "Failed",
  unknown: "Checking",
  expired: "Expired",
  awaiting: "Waiting",
  detected: "Checking NEAR",
  settling: "Settling",
  succeeded: "Paid",
  refunded: "Refunded",
}

const DONE: ActivityItem["status"][] = ["success", "succeeded"]
const BAD: ActivityItem["status"][] = ["failed", "expired", "refunded"]

/** One movement: what happened, with whom, when, and the signed amount. A payment opens its receipt. */
function ActivityRow({
  item,
  index,
  reduce,
}: {
  item: ActivityItem
  index: number
  reduce: boolean
}) {
  const incoming = item.kind === "received"
  const headline =
    item.kind === "received"
      ? `${item.title ?? "Pay link"} · paid`
      : item.kind === "paid"
        ? `Paid ${item.counterparty}`
        : `Sent to ${item.counterparty}`
  const detail =
    item.kind === "received"
      ? `From ${item.counterparty} · ${timeAgo(item.at)}`
      : item.kind === "paid" && item.title
        ? `${item.title} · ${timeAgo(item.at)}`
        : timeAgo(item.at)
  const receipt = item.receiptToken ? `/r/${item.receiptToken}` : null
  const body = (
    <>
      <Mark id="usdc" chain="near" size={40} />
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
        {incoming ? "+" : "−"}${viewDollars(item.amount).toFixed(2)}
      </span>
    </>
  )
  const cls = "press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
  const motionProps = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.04, duration: 0.32, ease: [0.2, 0.8, 0.2, 1] as const },
  }
  if (receipt)
    return (
      <motion.div {...motionProps}>
        <Link href={receipt} className={cls}>
          {body}
        </Link>
      </motion.div>
    )
  return (
    <motion.a
      href={item.explorerUrl ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={cls}
      {...motionProps}
    >
      {body}
    </motion.a>
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
      <span className="grid size-11 place-items-center rounded-full bg-black/10 [&_svg]:size-5">
        {busy ? <Spinner /> : icon}
      </span>
      <span className="flex flex-col gap-1">
        <span className="display text-[24px] leading-none">{title}</span>
        <span className="text-[14px] text-black/70">{detail}</span>
      </span>
    </>
  )
  const cls = cn(
    "press-lift flex min-h-36 flex-col justify-between gap-4 rounded-[20px] p-5 text-left text-black",
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
