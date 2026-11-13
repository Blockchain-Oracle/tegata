"use client"

// Business → Team: payroll that needs more than one person. The owner invites approvers by email; once they've joined,
// Tegata creates the business a team treasury on NEAR (a Sputnik DAO, the contract Trezu runs on) that pays only when k
// of them vote yes; the owner seals it with one hold, then moves payroll money in. Approvers vote from Approvals.
import {
  Check,
  Copy,
  ExternalLink,
  Landmark,
  Minus,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react"
import { useEffect, useState } from "react"

import { BusinessSeal } from "@/components/brand/seal"
import { CustomerDisc } from "@/components/invoices/customer-picker"
import { AccountLink } from "@/components/kit/account-link"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Stage } from "@/components/kit/stage"
import { ErrorState, LoadingShape, StatusPill } from "@/components/kit/states"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark } from "@/components/marks/mark"
import { money } from "@/components/payroll/payroll-view"
import { Sheet } from "@/components/shell/sheet"
import { fire } from "@/lib/feedback"

export interface TeamMemberView {
  id: string
  name: string
  email: string
  status: "invited" | "active" | "removed"
  accountId: string | null
  token: string
}

export interface TreasuryView {
  id: string
  accountId: string
  threshold: number
  approvers: string[]
  status: "creating" | "sealing" | "ready" | "failed"
  error: string | null
  balance: string
  explorerUrl: string
  trezuUrl: string | null
}

export interface TeamData {
  ownerAccount: string | null
  members: TeamMemberView[]
  treasury: TreasuryView | null
}

const STEPS = [
  {
    id: "create",
    label: "Creating the treasury on NEAR",
    detail: "paid by Tegata",
    mark: "near" as const,
  },
  { id: "usdc", label: "Registering it for dollars", mark: "usdc" as const },
  {
    id: "seal",
    label: "Sealing it",
    detail: "no code updates; every change needs the approvers",
    icon: <ShieldCheck />,
  },
]

export function TeamView({
  data,
  business,
  network,
  error,
  onRetry,
  inviting,
  inviteProblem,
  lastInvite,
  onInvite,
  onRemove,
  opening,
  openProblem,
  onOpen,
  sealing,
  sealProblem,
  onSeal,
  funding,
  fundProblem,
  onFund,
}: {
  data: TeamData | undefined
  business: string
  network: "testnet" | "mainnet"
  error: boolean
  onRetry: () => void
  inviting: boolean
  inviteProblem: string | null
  /** The invite just made: its link to send. */
  lastInvite: { name: string; email: string; link: string } | null
  onInvite: (input: { name: string; email: string }) => void
  onRemove: (memberId: string) => void
  opening: boolean
  openProblem: string | null
  onOpen: (threshold: number) => void
  sealing: boolean
  sealProblem: string | null
  onSeal: () => void
  funding: boolean
  fundProblem: string | null
  onFund: (amount: string) => void
}) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [fundOpen, setFundOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [amount, setAmount] = useState("")
  const [threshold, setThreshold] = useState(2)
  const [copied, setCopied] = useState<string | null>(null)

  const members = data?.members ?? []
  const n = 1 + members.length
  useEffect(() => {
    setThreshold((k) => Math.min(Math.max(2, k), Math.max(2, n)))
  }, [n])

  const header = (
    <header className="flex flex-col gap-1">
      <h1 className="display text-page-title">Team</h1>
      <p className="text-[15px] text-muted-foreground">
        Payroll that needs more than one person to approve.
      </p>
    </header>
  )
  if (error)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState
          title="Couldn't load your team"
          detail="Nothing changes while this is down."
          onRetry={onRetry}
        />
      </div>
    )
  if (!data)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <LoadingShape shape="card" className="h-[200px] rounded-[24px]" />
        <div className="rounded-[20px] bg-card p-3">
          <LoadingShape shape="list" />
        </div>
      </div>
    )

  const t = data.treasury
  const live = t && t.status !== "failed"
  const waiting = members.filter((m) => m.status !== "active")
  const canOpen = !live && members.length > 0 && waiting.length === 0
  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    fire("tick", { cue: "confirmed" })
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }
  const inviteLink = (token: string) =>
    `${typeof window === "undefined" ? "" : window.location.origin}/team/${token}`

  return (
    <div className="flex flex-col gap-6">
      {header}

      <Stage className="p-6 sm:p-8">
        {t?.status === "ready" ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 text-[15px] font-medium text-white/85">
                <Landmark className="size-4" /> Team treasury · {t.threshold} of{" "}
                {t.approvers.length} approve
              </span>
              <Figure
                value={viewDollars(t.balance)}
                className="text-[56px] text-white sm:text-[72px]"
              />
              <span className="inline-flex items-center gap-2 text-[14px] text-white/85">
                <Mark id="near" size={18} />
                <span className="truncate font-mono">{t.accountId}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="paper" size="sm" onClick={() => setFundOpen(true)}>
                <Plus /> Add money
              </Button>
              <Button variant="veil" size="sm" asChild>
                <a href={t.explorerUrl} target="_blank" rel="noreferrer">
                  On NEAR <ExternalLink />
                </a>
              </Button>
              {t.trezuUrl ? (
                <Button variant="veil" size="sm" asChild>
                  <a href={t.trezuUrl} target="_blank" rel="noreferrer">
                    In Trezu <ExternalLink />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : live ? (
          <div className="flex flex-col gap-4">
            <span className="text-[15px] font-medium text-white/85">Opening the team treasury</span>
            <div className="rounded-[20px] bg-white p-2">
              <TaskSteps steps={STEPS} current={t.status === "creating" ? 0 : 2} tone="paper" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-2 text-[15px] font-medium text-white/85">
              <ShieldCheck className="size-4" /> Payroll approvals
            </span>
            <span className="display text-[44px] leading-none text-white sm:text-[56px]">
              {members.length ? `${threshold} of ${n}` : "Just you"}
            </span>
            <span className="max-w-[46ch] text-[15px] text-white/85">
              Approvers vote with their own keys on NEAR. The treasury pays only when enough say
              yes; Tegata can't pay alone.
            </span>
          </div>
        )}
      </Stage>

      {t?.status === "sealing" ? (
        <div className="flex flex-col gap-3 rounded-[20px] bg-card p-5">
          <span className="text-[17px] font-semibold">Seal the treasury</span>
          <span className="text-[15px] text-muted-foreground">
            Switches off code updates and locks the rule, so any change needs {t.threshold} of{" "}
            {t.approvers.length}.
          </span>
          {sealProblem || t.error ? (
            <p className="text-[14px] font-medium text-down">{sealProblem ?? t.error}</p>
          ) : null}
          <HoldButton label="Hold to seal the treasury" busy={sealing} onConfirm={onSeal} />
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[17px] font-semibold">Approvers</span>
          {!live ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setName("")
                setEmail("")
                setInviteOpen(true)
              }}
            >
              <UserPlus /> Add an approver
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col rounded-[20px] bg-card p-2">
          <div className="flex items-center gap-3 rounded-[14px] px-3 py-3">
            <BusinessSeal name={business} size={40} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[16px] font-semibold">You · owner</span>
              {data.ownerAccount ? (
                <AccountLink
                  accountId={data.ownerAccount}
                  network={network}
                  className="text-[12px]"
                />
              ) : null}
            </span>
            <StatusPill tone="up">Approves</StatusPill>
          </div>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-[14px] px-3 py-3">
              <CustomerDisc name={m.name} size={40} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[16px] font-semibold">{m.name}</span>
                {m.accountId ? (
                  <AccountLink accountId={m.accountId} network={network} className="text-[12px]" />
                ) : (
                  <span className="truncate text-detail text-muted-foreground">{m.email}</span>
                )}
              </span>
              {m.status === "active" ? (
                <StatusPill tone="up">Joined</StatusPill>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void copy(inviteLink(m.token), m.id)}
                    className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-[13px] font-semibold [&_svg]:size-4"
                  >
                    {copied === m.id ? <Check /> : <Copy />}{" "}
                    {copied === m.id ? "Copied" : "Invite link"}
                  </button>
                  <StatusPill tone="wait">Invited</StatusPill>
                </>
              )}
              {!live ? (
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => onRemove(m.id)}
                  className="press grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-down [&_svg]:size-4"
                >
                  <Trash2 />
                </button>
              ) : null}
            </div>
          ))}
          {members.length === 0 ? (
            <p className="px-3 py-3 text-[15px] text-muted-foreground">
              Add a co-founder or your finance lead: they approve payroll with you.
            </p>
          ) : null}
        </div>
      </section>

      {!live ? (
        <section className="flex flex-col gap-4 rounded-[20px] bg-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[17px] font-semibold">Payroll needs</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary p-1">
              <button
                type="button"
                aria-label="Fewer approvals"
                disabled={threshold <= 2}
                onClick={() => setThreshold((k) => k - 1)}
                className="press grid size-9 place-items-center rounded-full bg-card disabled:opacity-40 [&_svg]:size-4"
              >
                <Minus />
              </button>
              <span className="tnum w-8 text-center text-[17px] font-semibold">{threshold}</span>
              <button
                type="button"
                aria-label="More approvals"
                disabled={threshold >= n}
                onClick={() => setThreshold((k) => k + 1)}
                className="press grid size-9 place-items-center rounded-full bg-card disabled:opacity-40 [&_svg]:size-4"
              >
                <Plus />
              </button>
            </span>
            <span className="text-[17px] font-semibold">of {n} approvals</span>
          </div>
          <span className="text-[14px] text-muted-foreground">
            {members.length === 0
              ? "Add at least one approver first."
              : waiting.length
                ? `Waiting for ${waiting.map((m) => m.name).join(", ")} to join from their invite.`
                : `Each payroll waits for ${threshold} yes votes, yours included, before the treasury pays.`}
          </span>
          {openProblem || (t?.status === "failed" ? t.error : null) ? (
            <p className="text-[14px] font-medium text-down">{openProblem ?? t?.error}</p>
          ) : null}
          <Button busy={opening} disabled={!canOpen} onClick={() => onOpen(threshold)}>
            <ShieldCheck /> Open the team treasury
          </Button>
        </section>
      ) : null}

      <Sheet open={inviteOpen} onOpenChange={setInviteOpen} title="Add an approver">
        {lastInvite &&
        !inviting &&
        !inviteProblem &&
        lastInvite.email === email.trim().toLowerCase() ? (
          <div className="flex flex-col gap-4">
            <p className="text-[15px]">
              Send {lastInvite.name} this link. They sign in with {lastInvite.email} and join as an
              approver.
            </p>
            <div className="flex items-center gap-2 rounded-[14px] bg-secondary px-4 py-3">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                {lastInvite.link}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void copy(lastInvite.link, "sheet")}
              >
                {copied === "sheet" ? <Check /> : <Copy />} {copied === "sheet" ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              onInvite({ name, email })
            }}
          >
            <Field
              id="approver-name"
              label="Name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
            <Field
              id="approver-email"
              label="Email"
              type="email"
              value={email}
              maxLength={120}
              onChange={(e) => setEmail(e.target.value)}
            />
            <span className="text-detail text-muted-foreground">
              They sign in with this email; their own Tegata account is the one that votes.
            </span>
            {inviteProblem ? (
              <p className="text-[14px] font-medium text-down">{inviteProblem}</p>
            ) : null}
            <Button type="submit" busy={inviting} disabled={!name.trim() || !email.trim()}>
              <UserPlus /> Add approver
            </Button>
          </form>
        )}
      </Sheet>

      <Sheet open={fundOpen} onOpenChange={setFundOpen} title="Add money to the treasury">
        <div className="flex flex-col gap-4">
          <Field
            id="fund-amount"
            label="Amount"
            inputMode="decimal"
            placeholder="0.00"
            leading={<span className="text-muted-foreground">$</span>}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="text-detail text-muted-foreground">
            From your balance. Once in, it leaves only by {t?.threshold ?? 2} approvals.
          </span>
          {fundProblem ? <p className="text-[14px] font-medium text-down">{fundProblem}</p> : null}
          <HoldButton
            label={
              /^\d+(\.\d{1,2})?$/.test(amount)
                ? `Hold to move ${money(BigInt(Math.round(Number(amount) * 100)) * 10_000n)}`
                : "Enter an amount"
            }
            ready={/^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0}
            busy={funding}
            onConfirm={() => onFund(amount)}
          />
        </div>
      </Sheet>
    </div>
  )
}
