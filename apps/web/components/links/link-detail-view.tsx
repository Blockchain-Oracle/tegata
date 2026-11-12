"use client"

// One pay link (plan 6.8 G): the link card and its QR on the stage with Copy, Share and Open; then what it has
// received and every payment, newest first. A link made a moment ago lands with the business seal pressed once.
import { ArrowLeft, Check, Copy, ExternalLink, ReceiptText, Share2 } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"

import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Paper, Stage, StageAction, StageObject } from "@/components/kit/stage"
import { EmptyState, ErrorState, LoadingShape, Skeleton, StatusPill } from "@/components/kit/states"
import { Switch } from "@/components/kit/switch"
import { Mark, MarkStack } from "@/components/marks/mark"
import type { LinkDetail, LinkPayment } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

const COPIED_MS = 1500

export interface LinkDetailViewProps {
  detail: LinkDetail | undefined
  error: boolean
  businessName: string
  /** The public pay page's full URL. */
  url: string | null
  /** Just created: press the seal once. */
  fresh: boolean
  toggling: boolean
  onToggle: (open: boolean) => void
  onRetry: () => void
}

export function LinkDetailView(p: LinkDetailViewProps) {
  const [copied, setCopied] = useState(false)
  const link = p.detail?.request

  const copy = async () => {
    if (!p.url) return
    await navigator.clipboard.writeText(p.url)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }
  const share = async () => {
    if (!p.url || !link) return
    if (navigator.share)
      await navigator
        .share({ title: `Pay ${p.businessName}`, text: link.title, url: p.url })
        .catch(() => undefined)
    else await copy()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/app/links"
          className="press grid size-10 shrink-0 place-items-center rounded-full bg-secondary hover:bg-plate-pressed"
          aria-label="All pay links"
        >
          <ArrowLeft className="size-4" />
        </Link>
        {link ? (
          <h1 className="display truncate text-page-title">{link.title}</h1>
        ) : (
          <Skeleton className="h-10 w-56" />
        )}
      </div>

      {p.error ? (
        <ErrorState
          title="Couldn't load this pay link"
          detail="The link itself still works for anyone paying it."
          onRetry={p.onRetry}
        />
      ) : !link ? (
        <div className="flex flex-col gap-4" role="status" aria-label="Loading pay link">
          <Skeleton className="h-[360px] w-full rounded-[24px]" />
          <div className="rounded-[20px] bg-card p-3">
            <LoadingShape shape="list" />
          </div>
        </div>
      ) : (
        <>
          <Stage className="p-5 sm:p-8">
            <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-6">
                <StageObject from={{ y: 16, rotate: -2 }} drift={false}>
                  <Paper className="relative p-5 sm:p-6">
                    <span className="text-[13px] font-semibold text-[#666]">
                      Pay {p.businessName}
                    </span>
                    <span className="mt-1 block truncate pr-16 text-[18px] font-semibold">
                      {link.title}
                    </span>
                    {link.amount ? (
                      <Figure value={viewDollars(link.amount)} className="mt-1 text-[56px]" />
                    ) : (
                      <span className="display mt-1 block text-[44px] leading-none">
                        Any amount
                      </span>
                    )}
                    {link.note ? (
                      <p className="mt-2 line-clamp-2 text-[14px] text-[#666]">{link.note}</p>
                    ) : null}
                    <span className="mt-4 flex items-center gap-2 text-[13px] font-medium text-[#666]">
                      <MarkStack ids={["usdc", "near"]} size={18} /> USDC on NEAR
                      {link.network === "testnet" ? " · Sandbox" : ""}
                    </span>
                    <div className="absolute -top-6 -right-5">
                      <SealPress
                        play={p.fresh}
                        delay={0.35}
                        onLanded={() =>
                          fire("filled", { cue: "stamp", identity: `link:${link.id}` })
                        }
                      >
                        <BusinessSeal name={p.businessName} size={88} />
                      </SealPress>
                    </div>
                  </Paper>
                </StageObject>
                <div className="flex gap-4 sm:gap-6">
                  <StageAction
                    label={copied ? "Copied" : "Copy"}
                    onClick={copy}
                    icon={copied ? <Check /> : <Copy />}
                  />
                  <StageAction label="Share" onClick={share} icon={<Share2 />} />
                  {p.url ? (
                    <StageAction label="Open" href={p.url} external icon={<ExternalLink />} />
                  ) : null}
                </div>
              </div>
              <StageObject className="mx-auto" from={{ y: 24, rotate: 3 }} delay={0.08}>
                <div className="rounded-[24px] bg-white p-4 shadow-object">
                  {p.url ? (
                    <QRCodeSVG
                      value={p.url}
                      size={208}
                      level="M"
                      imageSettings={{ src: "/icon.svg", height: 44, width: 44, excavate: true }}
                    />
                  ) : (
                    <Skeleton className="size-[208px]" />
                  )}
                </div>
              </StageObject>
            </div>
            {p.url ? (
              <div className="mt-6 truncate rounded-full bg-white/18 px-4 py-2 text-center font-mono text-[14px] text-white">
                {p.url.replace(/^https?:\/\//, "")}
              </div>
            ) : null}
          </Stage>

          <div className="grid gap-3 sm:grid-cols-3">
            <Fact label="Received">
              <Figure value={viewDollars(link.paidTotal)} className="text-[32px]" />
            </Fact>
            <Fact label="Payments">
              <Figure value={link.paidCount} plain className="text-[32px]" />
            </Fact>
            <div className="flex items-center justify-between gap-3 rounded-[20px] bg-card p-5">
              <span className="flex flex-col">
                <span className="text-detail font-medium text-muted-foreground">
                  Taking payments
                </span>
                <span className="text-[17px] font-semibold">
                  {link.status === "open" ? "Open" : link.status === "paid" ? "Paid" : "Paused"}
                </span>
              </span>
              <Switch
                checked={link.status === "open"}
                onCheckedChange={p.onToggle}
                disabled={p.toggling || link.status === "paid"}
                label="Taking payments"
              />
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-section-title font-semibold">Payments</h2>
            {p.detail && p.detail.payments.length > 0 ? (
              <div className="flex flex-col rounded-[20px] bg-card p-2">
                {p.detail.payments.map((payment, i) => (
                  <PaymentRow key={payment.id} payment={payment} index={i} />
                ))}
              </div>
            ) : (
              <EmptyState
                art={<ReceiptText />}
                field="kin"
                title="No payments yet"
                detail="Share the link. Each payment lands here the moment NEAR settles it."
                action={
                  p.url ? (
                    <Button variant="secondary" size="md" asChild>
                      <a href={p.url} target="_blank" rel="noreferrer">
                        Open the pay page <ExternalLink />
                      </a>
                    </Button>
                  ) : undefined
                }
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] bg-card p-5">
      <span className="text-detail font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

const RAIL: Record<LinkPayment["rail"], string> = {
  tegata: "Tegata balance",
  near_wallet: "NEAR wallet",
  oneclick: "Another chain",
  manual: "Paid by hand",
}

const PAYMENT_WORD: Record<LinkPayment["status"], string> = {
  awaiting: "Waiting",
  detected: "Checking NEAR",
  settling: "Settling",
  succeeded: "Paid",
  refunded: "Refunded",
  failed: "Failed",
  expired: "Expired",
}

export function RailMark({ rail, size = 40 }: { rail: LinkPayment["rail"]; size?: number }) {
  if (rail === "tegata")
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-white shadow-object"
        style={{ width: size, height: size }}
      >
        <TegataSeal size={Math.round(size * 0.62)} textured={false} tilt={0} />
      </span>
    )
  if (rail === "manual")
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold text-muted-foreground"
        style={{ width: size, height: size }}
        role="img"
        aria-label="Paid by hand"
      >
        $
      </span>
    )
  return <Mark id={rail === "near_wallet" ? "near" : "intents"} size={size} />
}

function PaymentRow({ payment, index }: { payment: LinkPayment; index: number }) {
  const reduce = useReducedMotion()
  const paid = payment.status === "succeeded"
  const bad =
    payment.status === "failed" || payment.status === "expired" || payment.status === "refunded"
  const when = new Date(payment.settledAt ?? payment.createdAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
  const body = (
    <>
      <RailMark rail={payment.rail} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-mono text-[15px] font-medium">
          {payment.payer ?? payment.payerEmail ?? "Payer"}
        </span>
        <span className="truncate text-detail text-muted-foreground">
          {RAIL[payment.rail]} · {when}
        </span>
      </span>
      {paid ? null : (
        <StatusPill tone={bad ? "down" : "wait"}>{PAYMENT_WORD[payment.status]}</StatusPill>
      )}
      <span className={cn("tnum text-[16px] font-semibold", paid ? "text-up" : "text-text-3")}>
        {paid ? "+" : ""}${viewDollars(payment.amount).toFixed(2)}
      </span>
      {payment.receiptToken ? <ReceiptText className="size-4 text-text-3" /> : null}
    </>
  )
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {payment.receiptToken ? (
        <Link
          href={`/r/${payment.receiptToken}`}
          className="press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-[14px] px-3 py-3">{body}</div>
      )}
    </motion.div>
  )
}
