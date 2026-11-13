"use client"

// Every surface's states (DESIGN.md "States"), from Senryo/Kawase's kit and 21st sources:
// shadcn skeleton (1588) in shaped layouts, serafimcloud/empty-state (1435) and cnippet-dev/v-alert-7 (23621) for
// empty and error, ibelick/text-shimmer (1641) for waits. Loading is held at least 300 ms so nothing flickers.
import { AlertTriangle, RotateCw } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"

import { Button } from "@/components/kit/button"
import { cn } from "@/lib/utils"

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("animate-skeleton rounded-[10px] bg-skeleton", className)} />
  )
}

/** A skeleton shaped like the real layout. */
export function LoadingShape({
  shape,
  className,
}: {
  shape: "row" | "list" | "hero" | "card"
  className?: string
}) {
  if (shape === "row")
    return (
      <div
        className={cn("flex items-center gap-3 py-2", className)}
        role="status"
        aria-label="Loading"
      >
        <Skeleton className="size-9 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-[46%]" />
          <Skeleton className="h-3 w-[28%]" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    )
  if (shape === "list")
    return (
      <div className={cn("flex flex-col gap-1", className)} role="status" aria-label="Loading">
        {[0, 1, 2, 3].map((i) => (
          <LoadingShape key={i} shape="row" />
        ))}
      </div>
    )
  if (shape === "hero")
    return (
      <div className={cn("flex flex-col gap-3", className)} role="status" aria-label="Loading">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-[52px] w-[54%]" />
        <div className="mt-2 flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="size-14 rounded-full" />
          ))}
        </div>
      </div>
    )
  return <Skeleton className={cn("h-32 w-full rounded-[20px]", className)} />
}

/** Show a skeleton only after 120 ms, and once shown keep it at least 300 ms (Kawase's useHeldLoading). */
export function useHeldLoading(loading: boolean, delayMs = 120, minMs = 300): boolean {
  const [shown, setShown] = useState(false)
  const [since, setSince] = useState(0)
  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => {
        setShown(true)
        setSince(Date.now())
      }, delayMs)
      return () => clearTimeout(t)
    }
    if (!shown) return
    const left = Math.max(0, minMs - (Date.now() - since))
    const t = setTimeout(() => setShown(false), left)
    return () => clearTimeout(t)
  }, [loading, delayMs, minMs, shown, since])
  return shown
}

export function TextShimmer({ children, className }: { children: string; className?: string }) {
  const reduced = useReducedMotion() === true
  if (reduced) return <span className={cn("text-muted-foreground", className)}>{children}</span>
  return (
    <motion.span
      className={cn(
        "inline-block bg-[linear-gradient(90deg,var(--muted-foreground)_35%,var(--foreground)_50%,var(--muted-foreground)_65%)] bg-size-[250%_100%] bg-clip-text font-medium text-transparent",
        className,
      )}
      initial={{ backgroundPosition: "100% center" }}
      animate={{ backgroundPosition: "0% center" }}
      transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2, ease: "linear" }}
    >
      {children}
    </motion.span>
  )
}

/** "Opening your account" → "· 6 s" after 3 s → "Still waiting · Retry" at 15 s. */
export function WaitingText({
  verb,
  startedAt,
  onRetry,
  className,
}: {
  verb: string
  startedAt: number
  onRetry?: () => void
  className?: string
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const s = Math.max(0, Math.floor((now - startedAt) / 1000))
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[15px]", className)} role="status">
      <TextShimmer>{s >= 15 ? "Still waiting" : verb}</TextShimmer>
      {s >= 3 && s < 15 ? <span className="tnum text-text-3">· {s} s</span> : null}
      {s >= 15 && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="font-semibold text-shu-ink underline-offset-2 hover:underline"
        >
          · Retry
        </button>
      ) : null}
    </span>
  )
}

const FIELD_TONE = {
  sora: "bg-sora",
  matcha: "bg-matcha",
  sakura: "bg-sakura",
  kin: "bg-kin",
  shu: "bg-shu",
} as const

/** Says why it's empty and names the next action, on a story-field tile so it is never grey. */
export function EmptyState({
  art,
  field = "sora",
  title,
  detail,
  action,
  className,
}: {
  art: React.ReactNode
  field?: keyof typeof FIELD_TONE
  title: string
  detail?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-[20px] bg-card px-6 py-10 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "grid size-20 place-items-center rounded-[22px] text-black [&_svg]:size-9",
          FIELD_TONE[field],
        )}
      >
        {art}
      </div>
      <div className="flex max-w-xs flex-col gap-1">
        <p className="text-section-title font-semibold">{title}</p>
        {detail ? <p className="text-[15px] text-muted-foreground">{detail}</p> : null}
      </div>
      {action}
    </div>
  )
}

/** Says what still works and offers one action; the technical text sits behind a disclosure. */
export function ErrorState({
  title,
  detail,
  stillWorks,
  onRetry,
  technical,
  className,
}: {
  title: string
  detail?: string
  stillWorks?: string
  onRetry?: () => void
  technical?: string
  className?: string
}) {
  return (
    <div
      className={cn("flex flex-col gap-4 rounded-[20px] bg-down-surface p-5", className)}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warn-surface text-warn">
          <AlertTriangle className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-[17px] font-semibold">{title}</p>
          {detail ? <p className="text-[15px] text-muted-foreground">{detail}</p> : null}
          {stillWorks ? <p className="text-detail font-medium text-up">{stillWorks}</p> : null}
        </div>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="md" onClick={onRetry} className="self-start bg-card">
          <RotateCw /> Try again
        </Button>
      ) : null}
      {technical ? (
        <details className="text-meta text-muted-foreground">
          <summary className="cursor-pointer select-none">Technical details</summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono">{technical}</pre>
        </details>
      ) : null}
    </div>
  )
}

/** Paid, Sent, Waiting, Failed… always a word, never colour alone. */
export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: "up" | "down" | "warn" | "wait" | "shu" | "quiet"
  children: React.ReactNode
  className?: string
}) {
  const tones = {
    up: "bg-up-surface text-up",
    down: "bg-down-surface text-down",
    warn: "bg-warn-surface text-warn",
    wait: "bg-secondary text-foreground",
    shu: "bg-shu text-black",
    quiet: "bg-secondary text-muted-foreground",
  } as const
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {tone === "wait" ? <span className="size-1.5 animate-pulse rounded-full bg-shu" /> : null}
      {children}
    </span>
  )
}
