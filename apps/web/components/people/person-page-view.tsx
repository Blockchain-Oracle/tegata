"use client"

// The person's page (plan 6.8 P), phone first: the business's seal and "added you to payroll" with their pay on the
// stage, then where their pay should land as rows with real marks. A Tegata account (their own, opened with the
// invited email) or a NEAR account work today; another chain is Live-only and a bank account is coming, so both are
// shown locked. Once chosen: "You're set", any change waiting out its 24 hours, and their payslips.
import { Check, ChevronRight, Landmark, Lock } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { BusinessSeal, TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Stage } from "@/components/kit/stage"
import { StatusPill } from "@/components/kit/states"
import { Mark, MarkStack } from "@/components/marks/mark"
import { changesOn, DestinationMark, KIND_WORD } from "@/components/people/destination"
import type { PersonPage } from "@/lib/client/types"
import { cn } from "@/lib/utils"

const CADENCE_PHRASE = {
  weekly: "a week",
  fortnightly: "every two weeks",
  monthly: "a month",
} as const

export function PersonPageView({
  page,
  busy,
  problem,
  onTegata,
  onNear,
}: {
  page: PersonPage
  busy: boolean
  problem: string | null
  onTegata: () => void
  onNear: (accountId: string) => void
}) {
  const [choosing, setChoosing] = useState(page.ready.state === "none")
  const [near, setNear] = useState("")
  const [nearOpen, setNearOpen] = useState(false)
  const set = page.ready.state !== "none"
  const canChoose = Boolean(page.emailHint)
  const suffix = page.network === "testnet" ? ".testnet" : ".near"

  return (
    <div className="min-h-dvh bg-background">
      <Stage
        rounded={false}
        className="pb-16"
        inner="mx-auto flex max-w-[520px] flex-col gap-5 px-5 pt-8"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center overflow-hidden rounded-full bg-white shadow-object">
            {page.logo ? (
              <img src={page.logo} alt="" className="size-full object-cover" />
            ) : (
              <BusinessSeal name={page.business} size={50} tilt={-4} />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[18px] font-semibold text-white">{page.business}</span>
            <span className="text-[14px] font-medium text-white/85">added you to payroll</span>
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-medium text-white/85">
            {page.name}
            {page.role ? ` · ${page.role}` : ""}
          </span>
          <Figure value={viewDollars(page.amount)} className="text-[60px] text-white" />
          <span className="inline-flex items-center gap-2 text-[15px] font-medium text-white/85">
            <MarkStack ids={["usdc", "near"]} size={20} />
            {page.cadence
              ? `in dollars, ${CADENCE_PHRASE[page.cadence]}`
              : "in dollars, each payday"}
            {page.network === "testnet" ? " · Sandbox" : ""}
          </span>
        </div>
      </Stage>

      <main className="relative z-10 mx-auto -mt-10 flex max-w-[520px] flex-col gap-5 px-4 pb-12">
        {set && !choosing ? (
          <section className="flex flex-col gap-3 rounded-[24px] bg-card p-5 shadow-object">
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-up">
              <span className="grid size-6 place-items-center rounded-full bg-up-surface">
                <Check className="size-4" />
              </span>
              You're set
            </span>
            {page.ready.state !== "none" ? (
              <div className="flex items-center gap-3">
                <DestinationMark kind={page.ready.kind} size={40} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[17px] font-semibold">
                    Your pay lands in your {KIND_WORD[page.ready.kind]}
                  </span>
                  <span className="truncate font-mono text-[13px] text-muted-foreground">
                    {page.ready.accountId ?? "opening now"}
                    {page.ready.state === "opening" ? " · getting it ready for dollars" : ""}
                  </span>
                </span>
              </div>
            ) : null}
            {page.pending ? (
              <p className="rounded-[12px] bg-warn-surface px-3 py-2 text-[14px] font-medium text-warn">
                Your change to {KIND_WORD[page.pending.kind]} takes over{" "}
                {changesOn(page.pending.activatesAt)}. Until then, pay keeps landing here.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {page.ready.state !== "none" && page.ready.kind === "tegata" ? (
                <Button size="md" asChild>
                  <Link href="/app">Open Tegata</Link>
                </Button>
              ) : null}
              {canChoose ? (
                <Button variant="secondary" size="md" onClick={() => setChoosing(true)}>
                  Change where it lands
                </Button>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-3 rounded-[24px] bg-card p-5 shadow-object">
            <h1 className="display text-[30px] leading-none">Where should your pay land?</h1>
            {canChoose ? (
              <p className="text-[15px] text-muted-foreground">
                Sign in with {page.emailHint}, the email you were invited with.
                {set ? " A change takes over 24 hours after you make it." : ""}
              </p>
            ) : (
              <p className="text-[15px] text-muted-foreground">
                Ask {page.business} to set where your pay lands.
              </p>
            )}
            <ChoiceRow
              art={
                <span className="grid size-11 place-items-center rounded-full bg-white shadow-object">
                  <TegataSeal size={28} textured={false} tilt={0} />
                </span>
              }
              title="Tegata account"
              badge={<StatusPill tone="shu">Recommended</StatusPill>}
              detail="Your own dollar account. No wallet, no fees."
              disabled={!canChoose || busy}
              onClick={onTegata}
            />
            <div className="flex flex-col rounded-[16px] bg-secondary">
              <ChoiceRow
                art={<Mark id="near" size={44} />}
                title="NEAR account"
                detail="One you already have"
                disabled={!canChoose || busy}
                onClick={() => setNearOpen((o) => !o)}
                flat
              />
              {nearOpen ? (
                <form
                  className="flex flex-col gap-2 px-3 pb-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (near.trim()) onNear(near.trim().toLowerCase())
                  }}
                >
                  <Field
                    id="person-near"
                    aria-label="Your NEAR account"
                    placeholder={`name${suffix}`}
                    value={near}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setNear(e.target.value)}
                  />
                  <Button type="submit" size="md" busy={busy} disabled={!near.trim()}>
                    Use this account
                  </Button>
                </form>
              ) : null}
            </div>
            <ChoiceRow
              art={<MarkStack ids={["base", "sol", "eth"]} size={26} />}
              title="Another chain"
              badge={
                <StatusPill tone="quiet" className="gap-1">
                  <Lock className="size-3" /> Live
                </StatusPill>
              }
              detail="USDC on Base, Solana and more, through NEAR Intents"
              disabled
            />
            <ChoiceRow
              art={
                <span className="grid size-11 place-items-center rounded-full bg-kin text-black">
                  <Landmark className="size-5" />
                </span>
              }
              title="Bank account"
              badge={
                <StatusPill tone="quiet" className="gap-1">
                  <Lock className="size-3" /> Coming
                </StatusPill>
              }
              detail="Cash out to your own bank"
              disabled
            />
            {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
            {set ? (
              <Button variant="secondary" size="md" onClick={() => setChoosing(false)}>
                Keep it as it is
              </Button>
            ) : null}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-section-title font-semibold">Payslips</h2>
          {page.slips.length === 0 ? (
            <p className="rounded-[20px] bg-card px-4 py-5 text-[15px] text-muted-foreground">
              Each payday adds one here, stamped by {page.business}.
            </p>
          ) : (
            <div className="flex flex-col rounded-[20px] bg-card p-2">
              {page.slips.map((slip) => (
                <Link
                  key={slip.id}
                  href={`/r/slip/${slip.id}`}
                  className="press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-matcha text-black">
                    <Check className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {slip.label}
                  </span>
                  <span className="tnum text-[16px] font-semibold text-up">
                    +${viewDollars(slip.amount).toFixed(2)}
                  </span>
                  <ChevronRight className="size-4 text-text-3" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="flex flex-col items-center gap-2 pt-4 text-[13px] font-medium text-muted-foreground">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Mark id="near" size={16} /> Settled on NEAR
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Mark id="circle" size={16} /> USDC by Circle
            </span>
          </span>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-semibold hover:text-foreground"
          >
            <TegataSeal size={16} textured={false} tilt={0} /> Tegata
          </Link>
        </footer>
      </main>
    </div>
  )
}

function ChoiceRow({
  art,
  title,
  badge,
  detail,
  disabled,
  onClick,
  flat,
}: {
  art: React.ReactNode
  title: string
  badge?: React.ReactNode
  detail: string
  disabled?: boolean
  onClick?: () => void
  flat?: boolean
}) {
  const locked = !onClick
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "press flex items-center gap-3 rounded-[16px] p-3 text-left enabled:hover:bg-plate-pressed disabled:cursor-default",
        !flat && "bg-secondary",
        locked && "opacity-60",
      )}
    >
      {art}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] font-semibold">
          <span className="whitespace-nowrap">{title}</span> {badge}
        </span>
        <span className="text-detail text-muted-foreground">{detail}</span>
      </span>
      {locked ? null : <ChevronRight className="size-4 text-text-3" />}
    </button>
  )
}
