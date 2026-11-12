"use client"

// Refer (plan 6.8 H; Wise's invite screens, Copperx's stablecoin referral panel): your join link and its QR on the
// stage, what you've earned, a tracker for each business you invited with its progress to the threshold, who invited
// you, and the terms in five lines. Separate from its logic so /dev/flows can show every state.
import { Check, Copy, ExternalLink, Gift, Share2, Users } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"

import { BusinessSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Paper, Stage, StageAction } from "@/components/kit/stage"
import { EmptyState, ErrorState, Skeleton, StatusPill } from "@/components/kit/states"
import type { ReferralRow, ReferralRules, ReferralsView } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

const COPIED_MS = 1500
const YEAR_MS = 365 * 86_400_000

const dollars = (units: string | bigint, digits = 2) => `$${viewDollars(units).toFixed(digits)}`

function minutesLeft(iso: string | null): string {
  if (!iso) return ""
  const ms = Date.parse(iso) - Date.now()
  if (ms <= 0) return "paying now"
  const min = Math.ceil(ms / 60_000)
  return min >= 120 ? `pays in ${Math.round(min / 60)} h` : `pays in ${min} min`
}

export interface ReferViewProps {
  data: ReferralsView | undefined
  error: boolean
  onRetry: () => void
  /** The join link's full URL. */
  url: string | null
  businessName: string
  explorer: (txHash: string) => string
  saving: boolean
  problem: string | null
  onSetReferrer: (handle: string) => void
  onRemoveReferrer: () => void
}

export function ReferView(p: ReferViewProps) {
  const [copied, setCopied] = useState(false)
  const [handle, setHandle] = useState("")
  if (p.error) return <ErrorState title="Couldn't load your referrals" onRetry={p.onRetry} />
  if (!p.data)
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Loading referrals">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-[320px] rounded-[24px]" />
        <Skeleton className="h-40 rounded-[20px]" />
      </div>
    )
  const { rules, invited, referredBy } = p.data
  const reward = dollars(rules.reward, 0)
  const threshold = dollars(rules.threshold, 0)
  const sandbox = p.data.network === "testnet"
  const earned =
    BigInt(invited.filter((r) => r.payout?.status === "sent").length) * BigInt(rules.reward)
  const pending =
    BigInt(invited.filter((r) => r.status === "qualified").length) * BigInt(rules.reward)
  const usedThisYear = invited.filter(
    (r) => r.status === "paid" && r.paidAt && Date.now() - Date.parse(r.paidAt) < YEAR_MS,
  ).length

  const copy = async () => {
    if (!p.url) return
    await navigator.clipboard.writeText(p.url)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }
  const share = async () => {
    if (!p.url) return
    if (navigator.share)
      await navigator
        .share({
          title: `Join ${p.businessName} on Tegata`,
          text: `Get paid in dollars from any chain. We both get ${reward}.`,
          url: p.url,
        })
        .catch(() => undefined)
    else await copy()
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="display text-page-title">Refer</h1>

      <Stage className="p-5 sm:p-8">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-medium text-white/85">
                Invite a business you work with
              </span>
              <span className="display text-[44px] leading-none text-white sm:text-[56px]">
                You both get {reward}
              </span>
              <span className="max-w-md text-[15px] text-white/90">
                When they receive {threshold} from their customers in their first {rules.windowDays}{" "}
                days, you each get {reward} in USDC on NEAR
                {sandbox ? " (test USDC in the Sandbox)" : ""}.
              </span>
            </div>
            <Paper className="flex items-center gap-3 px-4 py-3">
              <Gift className="size-5 shrink-0 text-[#FF4F00]" />
              <span className="min-w-0 flex-1 truncate font-mono text-[14px]">
                {p.url?.replace(/^https?:\/\//, "") ?? "…"}
              </span>
            </Paper>
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
          <div className="mx-auto rounded-[24px] bg-white p-4 shadow-object">
            {p.url ? (
              <QRCodeSVG
                value={p.url}
                size={188}
                level="M"
                imageSettings={{ src: "/icon.svg", height: 40, width: 40, excavate: true }}
              />
            ) : (
              <Skeleton className="size-[188px]" />
            )}
          </div>
        </div>
      </Stage>

      <div className="grid gap-3 sm:grid-cols-3">
        <Fact label="Earned">
          <Figure value={viewDollars(earned)} className="text-[32px]" />
        </Fact>
        <Fact label="Pending">
          <Figure value={viewDollars(pending)} className="text-[32px]" />
        </Fact>
        <Fact label="Rewards this year">
          <span className="figure text-[32px]">
            {usedThisYear}
            <span className="text-text-3"> of {rules.yearlyCap}</span>
          </span>
        </Fact>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title font-semibold">Businesses you invited</h2>
        {invited.length === 0 ? (
          <EmptyState
            art={<Users />}
            field="sora"
            title="No one yet"
            detail="Send your link to a business you work with. They sign in with email; no wallet needed."
            action={
              <Button variant="shu" onClick={share}>
                <Share2 /> Share your link
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col rounded-[20px] bg-card p-2">
            {invited.map((row) => (
              <InvitedRow key={row.id} row={row} rules={rules} explorer={p.explorer} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title font-semibold">Who invited you</h2>
        {referredBy ? (
          <div className="flex flex-col gap-3 rounded-[20px] bg-card p-4">
            <InvitedRow row={referredBy} rules={rules} explorer={p.explorer} you />
            {!referredBy.lockedAt && referredBy.status === "open" ? (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={p.onRemoveReferrer}
                busy={p.saving}
              >
                Remove
              </Button>
            ) : null}
          </div>
        ) : (
          <form
            className="flex flex-col gap-3 rounded-[20px] bg-card p-4 sm:flex-row sm:items-start"
            onSubmit={(e) => {
              e.preventDefault()
              if (handle.trim()) p.onSetReferrer(handle.trim())
            }}
          >
            <div className="flex-1">
              <Field
                id="referrer-handle"
                aria-label="Their pay address"
                placeholder="their-name"
                value={handle}
                onChange={(e) => setHandle(e.target.value.trim().toLowerCase())}
                trailing={<span className="font-mono text-[15px] text-text-3">.tegata.near</span>}
                className="font-mono"
                status={p.problem ? { kind: "bad", text: p.problem } : { kind: "none" }}
              />
            </div>
            <Button type="submit" busy={p.saving} disabled={!handle.trim()}>
              They invited me
            </Button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-[20px] bg-secondary/60 p-5 text-[14px] text-muted-foreground">
        <span className="font-semibold text-foreground">How it works</span>
        <span>
          · Only money from real customers counts: not from you, not from them, not from anyone
          either of you sent money to.
        </span>
        <span>
          · Each paying customer counts toward one invite only. Payments marked paid by hand don't
          count.
        </span>
        <span>· A business can have one referrer, set until it is first paid.</span>
        <span>
          · Rewards are paid{" "}
          {sandbox ? `${rules.holdMinutes} minutes` : `${Math.round(rules.holdMinutes / 60)} hours`}{" "}
          after the invite qualifies; a refund in that time cancels it.
        </span>
        <span>· Up to {rules.yearlyCap} rewards a year for each business that invites.</span>
      </section>
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

export function InvitedRow({
  row,
  rules,
  explorer,
  you,
}: {
  row: ReferralRow
  rules: ReferralRules
  explorer: (txHash: string) => string
  you?: boolean
}) {
  const received = BigInt(row.received)
  const threshold = BigInt(rules.threshold)
  const progress = threshold > 0n ? Math.min(100, Number((received * 100n) / threshold)) : 0
  const pill =
    row.status === "paid" ? (
      <StatusPill tone="up">Paid {dollars(rules.reward, 0)}</StatusPill>
    ) : row.status === "qualified" ? (
      <StatusPill tone="wait">{minutesLeft(row.payoutAfter)}</StatusPill>
    ) : row.status === "void" ? (
      <StatusPill tone="quiet">Not counted</StatusPill>
    ) : (
      <StatusPill tone="quiet">Joined</StatusPill>
    )
  return (
    <div className="flex items-center gap-3 rounded-[14px] px-3 py-3">
      <BusinessSeal name={row.business} size={40} tilt={0} />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-[16px] font-semibold">
            {you ? `Invited by ${row.business}` : row.business}
          </span>
        </span>
        {row.status === "void" ? (
          <span className="text-detail text-muted-foreground">{row.voidReason}</span>
        ) : row.status === "paid" && row.payout?.txHash ? (
          <a
            href={explorer(row.payout.txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 self-start text-detail font-semibold text-shu-ink hover:underline"
          >
            Reward sent on NEAR <ExternalLink className="size-3" />
          </a>
        ) : (
          <>
            <span className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
              <span
                className={cn(
                  "block h-full rounded-full",
                  row.status === "qualified" ? "bg-up" : "bg-shu",
                )}
                style={{ width: `${progress}%` }}
              />
            </span>
            <span className="text-detail text-muted-foreground">
              {dollars(received)} of {dollars(threshold, 0)} from customers
              {row.payout?.status === "failed" && row.payout.error ? ` · ${row.payout.error}` : ""}
            </span>
          </>
        )}
      </span>
      {pill}
    </div>
  )
}
