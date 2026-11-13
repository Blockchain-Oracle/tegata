"use client"

// Approvals: payrolls waiting on your vote across the businesses you approve for, and one payroll in detail (who it
// pays, who has voted, the proposal on NEAR) with hold to approve or decline. The vote that reaches k pays everyone.
import { ArrowLeft, Check, ExternalLink, Landmark, X } from "lucide-react"
import Link from "next/link"

import { BusinessSeal, SealPress } from "@/components/brand/seal"
import { CustomerDisc } from "@/components/invoices/customer-picker"
import { AccountLink } from "@/components/kit/account-link"
import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Stage } from "@/components/kit/stage"
import { EmptyState, ErrorState, LoadingShape, StatusPill } from "@/components/kit/states"
import { money } from "@/components/payroll/payroll-view"
import { fire } from "@/lib/feedback"

export interface ApprovalItem {
  runId: string
  business: string
  label: string
  total: string
  status: string
  threshold: number
  approvers: number
  approvals: number
  myVote: "approve" | "reject" | null
  mine: boolean
}

export interface ApprovalDetail {
  runId: string
  status: string
  business: string
  label: string
  total: string
  network: "testnet" | "mainnet"
  treasury: string
  treasuryUrl: string
  proposalId: number | null
  /** A failed run: until when Try again (the same proposal, finalized) can still pay it. */
  retryUntil?: string | null
  threshold: number
  me: string
  error: string | null
  rows: {
    id: string
    name: string
    role: string | null
    accountId: string | null
    amount: string
    status: string
    txHash: string | null
    txUrl: string | null
  }[]
  approvers: {
    account: string
    name: string
    owner: boolean
    vote: "approve" | "reject" | null
    at: string | null
  }[]
}

const statusWord = (a: { status: string; myVote: string | null; mine: boolean }) =>
  a.status === "paid"
    ? { tone: "up" as const, text: "Paid" }
    : a.status === "declined"
      ? { tone: "down" as const, text: "Declined" }
      : a.status === "expired"
        ? { tone: "quiet" as const, text: "Expired" }
        : a.status === "failed"
          ? { tone: "down" as const, text: "Didn't go through" }
          : a.status === "approved"
            ? { tone: "wait" as const, text: "Paying" }
            : a.myVote
              ? { tone: "quiet" as const, text: a.mine ? "Sent by you" : "You voted" }
              : { tone: "wait" as const, text: "Needs you" }

export function ApprovalsList({
  items,
  error,
  onRetry,
}: {
  items: ApprovalItem[] | undefined
  error: boolean
  onRetry: () => void
}) {
  const header = (
    <header className="flex flex-col gap-1">
      <h1 className="display text-page-title">Approvals</h1>
      <p className="text-[15px] text-muted-foreground">
        Payroll that waits for your yes before it pays.
      </p>
    </header>
  )
  if (error)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState
          title="Couldn't load approvals"
          detail="Nothing is paid while this is down."
          onRetry={onRetry}
        />
      </div>
    )
  if (!items)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-[20px] bg-card p-3">
          <LoadingShape shape="list" />
        </div>
      </div>
    )
  return (
    <div className="flex flex-col gap-6">
      {header}
      {items.length ? (
        <div className="flex flex-col rounded-[20px] bg-card p-2">
          {items.map((a) => {
            const word = statusWord(a)
            return (
              <Link
                key={a.runId}
                href={`/app/approvals/${a.runId}`}
                className="press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
              >
                <BusinessSeal name={a.business} size={40} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[16px] font-semibold">{a.business}</span>
                  <span className="truncate text-detail text-muted-foreground">
                    {a.label} · {a.approvals} of {a.threshold} approvals
                  </span>
                </span>
                <span className="tnum text-[16px] font-semibold">{money(a.total)}</span>
                <StatusPill tone={word.tone}>{word.text}</StatusPill>
              </Link>
            )
          })}
        </div>
      ) : (
        <EmptyState
          art={<Landmark />}
          field="sora"
          title="Nothing to approve"
          detail="When a business you approve for sends payroll, it waits here for your vote."
        />
      )}
    </div>
  )
}

export function ApprovalDetailView({
  detail,
  error,
  onRetry,
  busy,
  problem,
  onVote,
  onSendAgain,
  onTryAgain,
  retrying = false,
}: {
  detail: ApprovalDetail | undefined
  error: boolean
  onRetry: () => void
  busy: boolean
  problem: string | null
  onVote: (vote: "approve" | "reject") => void
  /** The owner's way back from declined or expired. */
  onSendAgain?: () => void
  /** The owner's retry of a failed batch: the same proposal, finalized again on NEAR. */
  onTryAgain?: () => void
  /** A retry is signed and on its way. */
  retrying?: boolean
}) {
  const back = (
    <Link
      href="/app/approvals"
      aria-label="Back to approvals"
      className="press grid size-10 place-items-center rounded-full bg-secondary hover:bg-plate-pressed"
    >
      <ArrowLeft className="size-4" />
    </Link>
  )
  if (error)
    return (
      <div className="flex flex-col gap-6">
        {back}
        <ErrorState
          title="Couldn't load this payroll"
          detail="Nothing is paid while this is down."
          onRetry={onRetry}
        />
      </div>
    )
  if (!detail)
    return (
      <div className="flex flex-col gap-6">
        {back}
        <LoadingShape shape="card" className="h-[200px] rounded-[24px]" />
      </div>
    )
  const approvals = detail.approvers.filter((a) => a.vote === "approve").length
  // A failed batch can be retried until its voting period ends; after that it goes back to review.
  const retryOpen = !detail.retryUntil || Date.now() < Date.parse(detail.retryUntil)
  const until = detail.retryUntil
    ? new Date(detail.retryUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null
  const myVote = detail.approvers.find((a) => a.account === detail.me)?.vote ?? null
  const open = detail.status === "proposed"
  const paid = detail.status === "paid"
  const txUrl = detail.rows.find((r) => r.txUrl)?.txUrl ?? null
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        {back}
        <h1 className="display min-w-0 flex-1 truncate text-page-title">{detail.label}</h1>
      </header>

      <Stage className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-2 text-[15px] font-medium text-white/85">
              <Landmark className="size-4" /> {detail.business} · team treasury
            </span>
            <Figure
              value={viewDollars(detail.total)}
              className="text-[56px] text-white sm:text-[72px]"
            />
            <span className="text-[15px] font-medium text-white/85">
              {paid
                ? `Paid ${detail.rows.length} ${detail.rows.length === 1 ? "person" : "people"} in one batch on NEAR`
                : `to ${detail.rows.length} ${detail.rows.length === 1 ? "person" : "people"} · ${approvals} of ${detail.threshold} approvals`}
            </span>
          </div>
          {paid ? (
            <SealPress
              delay={0.3}
              onLanded={() =>
                fire("filled", { cue: "stamp", identity: `treasury:${detail.runId}` })
              }
            >
              <span className="grid shrink-0 place-items-center rounded-full bg-white p-2 shadow-object">
                <BusinessSeal name={detail.business} band="Paid" size={96} />
              </span>
            </SealPress>
          ) : null}
        </div>
      </Stage>

      <section className="flex flex-col gap-3">
        <span className="text-[17px] font-semibold">Approvers</span>
        <div className="flex flex-col rounded-[20px] bg-card p-2">
          {detail.approvers.map((a) => (
            <div key={a.account} className="flex items-center gap-3 rounded-[14px] px-3 py-3">
              {a.owner ? (
                <BusinessSeal name={a.name} size={36} />
              ) : (
                <CustomerDisc name={a.name} size={36} />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">
                  {a.name}
                  {a.account === detail.me ? " (you)" : ""}
                </span>
                <AccountLink
                  accountId={a.account}
                  network={detail.network}
                  className="text-[12px]"
                />
              </span>
              {a.vote === "approve" ? (
                <StatusPill tone="up">
                  <Check className="size-3.5" /> Approved
                </StatusPill>
              ) : a.vote === "reject" ? (
                <StatusPill tone="down">
                  <X className="size-3.5" /> Declined
                </StatusPill>
              ) : (
                <StatusPill tone="quiet">Waiting</StatusPill>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-[17px] font-semibold">Who it pays</span>
        <div className="flex flex-col rounded-[20px] bg-card p-2">
          {detail.rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-[14px] px-3 py-3">
              <CustomerDisc name={row.name} size={36} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{row.name}</span>
                {row.accountId ? (
                  <AccountLink
                    accountId={row.accountId}
                    network={detail.network}
                    className="text-[12px]"
                  />
                ) : null}
              </span>
              <span className="tnum text-[15px] font-semibold">{money(row.amount)}</span>
              {row.status === "paid" ? (
                <Link
                  href={`/r/slip/${row.id}`}
                  className="press inline-flex h-9 items-center rounded-full bg-up-surface px-3 text-[14px] font-semibold text-up"
                >
                  Payslip
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {detail.error ? <p className="text-[14px] font-medium text-down">{detail.error}</p> : null}
      {problem ? <p className="text-[14px] font-medium text-down">{problem}</p> : null}

      {open && !myVote ? (
        <div className="flex flex-col gap-2">
          <HoldButton
            label={`Hold to approve ${money(detail.total)}`}
            busy={busy}
            onConfirm={() => onVote("approve")}
          />
          <Button variant="ghost" disabled={busy} onClick={() => onVote("reject")}>
            Decline
          </Button>
          <p className="text-center text-detail text-muted-foreground">
            {detail.threshold - approvals === 1
              ? "Yours is the last approval needed: it pays everyone, all or nobody."
              : `${detail.threshold - approvals} more approvals needed after yours.`}
          </p>
        </div>
      ) : open ? (
        <p className="rounded-[14px] bg-secondary px-4 py-3 text-[15px]">
          You {myVote === "approve" ? "approved" : "declined"}. Waiting for{" "}
          {detail.threshold - approvals} more.
        </p>
      ) : (detail.status === "declined" || detail.status === "expired") && onSendAgain ? (
        <Button variant="secondary" disabled={busy} onClick={onSendAgain}>
          Back to review, to send again
        </Button>
      ) : detail.status === "failed" && onTryAgain && retryOpen ? (
        <div className="flex flex-col gap-2">
          <p className="rounded-[14px] bg-secondary px-4 py-3 text-[15px]">
            {retrying
              ? "Trying again on NEAR. This page updates when it lands."
              : `Add money to the treasury if it was short, then try again${until ? ` by ${until}` : ""}: the same approvals pay everyone, all or nobody.`}
          </p>
          <HoldButton
            label={`Hold to try again · ${money(detail.total)}`}
            busy={busy || retrying}
            onConfirm={onTryAgain}
          />
        </div>
      ) : detail.status === "failed" && onSendAgain ? (
        <Button variant="secondary" disabled={busy} onClick={onSendAgain}>
          Back to review, to send again
        </Button>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" asChild>
          <a href={detail.treasuryUrl} target="_blank" rel="noreferrer">
            Treasury on NEAR <ExternalLink />
          </a>
        </Button>
        {txUrl ? (
          <Button variant="secondary" size="sm" asChild>
            <a href={txUrl} target="_blank" rel="noreferrer">
              The payment on NEAR <ExternalLink />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
