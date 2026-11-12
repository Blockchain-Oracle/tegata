"use client"

// Home (plan 6.8 C): the balance on a stage tile with four actions, the pay address as a sealed card, the latest
// movements as rows with real marks, and colour-field first steps for a new account. Separate from its data so
// /dev/flows can show every state.
import { ArrowDownLeft, ArrowUpRight, Check, Copy, ExternalLink, Send } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useState } from "react"

import { BusinessSeal } from "@/components/brand/seal"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Paper, Stage, StageObject } from "@/components/kit/stage"
import { LoadingShape, StatusPill } from "@/components/kit/states"
import { Mark, MarkStack } from "@/components/marks/mark"
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
              <Action label="Get paid" onClick={onReceive} icon={<ArrowDownLeft />} />
              <Action label="Send" href="/app/send" icon={<ArrowUpRight />} />
              <Action
                label={copied ? "Copied" : "Copy"}
                onClick={copy}
                icon={copied ? <Check /> : <Copy />}
              />
              <Action label="On NEAR" href={explorerUrl} external icon={<ExternalLink />} />
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
                <motion.a
                  key={item.id}
                  href={item.explorerUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <Mark id="usdc" chain="near" size={40} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[16px] font-semibold">
                      Sent to {item.counterparty}
                    </span>
                    <span className="truncate text-detail text-muted-foreground">
                      {timeAgo(item.at)}
                    </span>
                  </span>
                  {item.status === "success" ? null : (
                    <StatusPill
                      tone={item.status === "failed" || item.status === "expired" ? "down" : "wait"}
                    >
                      {STATUS_WORD[item.status]}
                    </StatusPill>
                  )}
                  <span className="tnum text-[16px] font-semibold">
                    −${viewDollars(item.amount).toFixed(2)}
                  </span>
                </motion.a>
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
              field="bg-sora"
              title="Share your pay address"
              detail="Anyone holding USDC on NEAR can pay you now."
              onClick={onReceive}
              icon={<ArrowDownLeft />}
            />
            {funded ? (
              <Tile
                field="bg-kin"
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

function Action({
  label,
  icon,
  onClick,
  href,
  external,
}: {
  label: string
  icon: React.ReactNode
  onClick?: () => void
  href?: string
  external?: boolean
}) {
  const circle = (
    <>
      <span className="grid size-14 place-items-center rounded-full bg-white text-black shadow-object transition-transform group-active:scale-95 [&_svg]:size-6">
        {icon}
      </span>
      <span className="text-[14px] font-semibold text-white">{label}</span>
    </>
  )
  const cls = "group press flex w-16 flex-col items-center gap-2"
  if (href)
    return external ? (
      <a href={href} target="_blank" rel="noreferrer" className={cls} onClick={() => fire("tick")}>
        {circle}
      </a>
    ) : (
      <Link href={href} className={cls} onClick={() => fire("tick")}>
        {circle}
      </Link>
    )
  return (
    <button
      type="button"
      className={cls}
      onClick={() => {
        fire("tick")
        onClick?.()
      }}
    >
      {circle}
    </button>
  )
}

function Tile({
  field,
  title,
  detail,
  icon,
  onClick,
  href,
  external,
}: {
  field: string
  title: string
  detail: string
  icon: React.ReactNode
  onClick?: () => void
  href?: string
  external?: boolean
}) {
  const body = (
    <>
      <span className="grid size-11 place-items-center rounded-full bg-black/10 [&_svg]:size-5">
        {icon}
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
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  )
}
