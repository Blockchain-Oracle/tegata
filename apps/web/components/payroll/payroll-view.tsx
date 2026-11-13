"use client"

// Payroll: the next payday on the stage with what it pays and to whom, the schedule in the business's
// time zone, the team's readiness, and every run so far. Separate from its data so /dev/flows can show every state.
import { CalendarClock, CalendarDays, ChevronRight, Play, Users } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { CustomerDisc } from "@/components/invoices/customer-picker"
import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Segmented } from "@/components/kit/segmented"
import { Stage } from "@/components/kit/stage"
import { EmptyState, ErrorState, LoadingShape, StatusPill } from "@/components/kit/states"
import { MarkStack } from "@/components/marks/mark"
import { DestinationPill } from "@/components/people/destination"
import type { PayCadence, PayRunSummary, PayrollOverview, TeamPerson } from "@/lib/client/types"

export const CADENCE_WORD: Record<PayCadence, string> = {
  weekly: "Weekly",
  fortnightly: "Every two weeks",
  monthly: "Monthly",
}

/** "Fri 28 Nov": a payday is a calendar date, so it is read as one (never shifted by the reader's clock). */
export const paydayText = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

export const money = (units: string | bigint) =>
  `$${viewDollars(units).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function RunStatusPill({ status }: { status: PayRunSummary["status"] }) {
  if (status === "paid") return <StatusPill tone="up">Paid</StatusPill>
  if (status === "failed") return <StatusPill tone="down">Didn't go through</StatusPill>
  if (status === "approved") return <StatusPill tone="wait">Paying</StatusPill>
  return <StatusPill tone="quiet">Draft</StatusPill>
}

export function PayrollView({
  overview,
  people,
  error,
  onRetry,
  today,
  savingSchedule,
  scheduleProblem,
  onSaveSchedule,
  starting,
  startProblem,
  onRun,
  autopilot,
  autopilotPays = false,
}: {
  overview: PayrollOverview | undefined
  people: TeamPerson[] | undefined
  error: boolean
  onRetry: () => void
  /** Today in the business's time zone (the earliest payday allowed). */
  today: string
  savingSchedule: boolean
  scheduleProblem: string | null
  onSaveSchedule: (cadence: PayCadence, nextPayday: string) => void
  starting: boolean
  startProblem: string | null
  onRun: () => void
  /** The autopilot card, shown under the schedule. */
  autopilot?: React.ReactNode
  /** The autopilot pays the next payday, so it isn't run by hand. */
  autopilotPays?: boolean
}) {
  const [editing, setEditing] = useState(false)
  if (error)
    return (
      <Shell>
        <ErrorState
          title="Couldn't load payroll"
          detail="Nothing is paid while this is down."
          onRetry={onRetry}
        />
      </Shell>
    )
  if (!overview || !people)
    return (
      <Shell>
        <LoadingShape shape="card" className="h-[190px] rounded-[24px]" />
        <div className="rounded-[20px] bg-card p-3">
          <LoadingShape shape="list" />
        </div>
      </Shell>
    )

  const ready = people.filter((p) => p.ready.state === "ready")
  const total = ready.reduce((sum, p) => sum + BigInt(p.amount), 0n)
  const schedule = overview.schedule

  return (
    <Shell>
      {people.length === 0 ? (
        <EmptyState
          art={<Users />}
          field="matcha"
          title="Add your people first"
          detail="Payroll pays everyone on your team who has chosen where their pay lands."
          action={
            <Button variant="shu" asChild>
              <Link href="/app/people">Add people</Link>
            </Button>
          }
        />
      ) : !schedule || editing ? (
        <ScheduleCard
          initial={schedule ? { cadence: schedule.cadence, nextPayday: schedule.nextPayday } : null}
          today={today}
          timezone={overview.timezone}
          saving={savingSchedule}
          problem={scheduleProblem}
          onCancel={schedule ? () => setEditing(false) : undefined}
          onSave={(cadence, payday) => {
            onSaveSchedule(cadence, payday)
            setEditing(false)
          }}
        />
      ) : (
        <>
          <Stage className="p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-2 text-[15px] font-medium text-white/85">
                  <MarkStack ids={["usdc", "near"]} size={22} /> Next payday ·{" "}
                  {paydayText(schedule.nextPayday)}
                </span>
                <Figure
                  value={viewDollars(total)}
                  className="text-[56px] text-white sm:text-[72px]"
                />
                <span className="text-[15px] font-medium text-white/85">
                  to {ready.length} {ready.length === 1 ? "person" : "people"}
                  {people.length > ready.length
                    ? ` · ${people.length - ready.length} not ready yet`
                    : ""}
                </span>
              </div>
              {autopilotPays ? (
                <span className="inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2.5 text-[15px] font-semibold text-black shadow-object sm:self-auto">
                  <CalendarClock className="size-4" /> Autopilot pays this one
                </span>
              ) : (
                <Button
                  variant="paper"
                  size="lg"
                  busy={starting}
                  disabled={!ready.length}
                  onClick={onRun}
                >
                  <Play /> Run payroll
                </Button>
              )}
            </div>
          </Stage>
          {startProblem ? (
            <p className="text-[15px] font-medium text-down">{startProblem}</p>
          ) : null}

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="press flex items-center gap-3 rounded-[20px] bg-card px-4 py-4 text-left hover:bg-secondary"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-kin text-black [&_svg]:size-5">
              <CalendarDays />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[16px] font-semibold">
                {CADENCE_WORD[schedule.cadence]} · next {paydayText(schedule.nextPayday)}
              </span>
              <span className="truncate text-detail text-muted-foreground">
                {schedule.label} · {overview.timezone}
              </span>
            </span>
            <span className="text-[15px] font-semibold text-shu-ink">Change</span>
          </button>

          {autopilot}

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-section-title font-semibold">The team</h2>
              <Link href="/app/people" className="text-[15px] font-semibold text-shu-ink">
                Manage people
              </Link>
            </div>
            <div className="flex flex-col rounded-[20px] bg-card p-2">
              {people.map((person) => (
                <Link
                  key={person.id}
                  href={`/app/people?id=${person.id}`}
                  className="press flex items-center gap-3 rounded-[14px] px-3 py-2.5 hover:bg-secondary"
                >
                  <CustomerDisc name={person.name} size={36} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {person.name}
                  </span>
                  <DestinationPill
                    ready={person.ready}
                    pending={person.pending}
                    hasEmail={Boolean(person.email)}
                  />
                  <span className="tnum w-24 text-right text-[15px] font-semibold">
                    {money(person.amount)}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-text-3" />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {overview.runs.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-section-title font-semibold">Past runs</h2>
          <div className="flex flex-col rounded-[20px] bg-card p-2">
            {overview.runs.map((run) => (
              <Link
                key={run.id}
                href={`/app/payroll/runs/${run.id}`}
                className="press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[16px] font-semibold">{run.label}</span>
                  <span className="truncate text-detail text-muted-foreground">
                    Payday {paydayText(run.payday)} · {run.people}{" "}
                    {run.people === 1 ? "person" : "people"}
                  </span>
                </span>
                {run.source === "autopilot" ? (
                  <StatusPill tone="wait" className="hidden sm:inline-flex">
                    By autopilot
                  </StatusPill>
                ) : null}
                <RunStatusPill status={run.status} />
                <span className="tnum text-[16px] font-semibold">{money(run.total)}</span>
                <ChevronRight className="size-4 text-text-3" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="display text-page-title">Payroll</h1>
      {children}
    </div>
  )
}

function ScheduleCard({
  initial,
  today,
  timezone,
  saving,
  problem,
  onCancel,
  onSave,
}: {
  initial: { cadence: PayCadence; nextPayday: string } | null
  today: string
  timezone: string
  saving: boolean
  problem: string | null
  onCancel?: () => void
  onSave: (cadence: PayCadence, nextPayday: string) => void
}) {
  const [cadence, setCadence] = useState<PayCadence>(initial?.cadence ?? "monthly")
  const [payday, setPayday] = useState(initial?.nextPayday ?? today)
  useEffect(() => {
    if (initial) {
      setCadence(initial.cadence)
      setPayday(initial.nextPayday)
    }
  }, [initial])
  return (
    <form
      className="flex flex-col gap-5 rounded-[24px] bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(cadence, payday)
      }}
    >
      <span className="grid size-12 place-items-center rounded-[16px] bg-kin text-black [&_svg]:size-6">
        <CalendarDays />
      </span>
      <h2 className="display text-[32px] leading-none">When do you pay your team?</h2>
      <Segmented
        label="How often"
        value={cadence}
        onValueChange={(v) => setCadence(v as PayCadence)}
        options={(Object.keys(CADENCE_WORD) as PayCadence[]).map((value) => ({
          value,
          label: CADENCE_WORD[value],
        }))}
      />
      <label className="flex flex-col gap-2">
        <span className="text-detail font-medium text-muted-foreground">
          Next payday ({timezone})
        </span>
        <input
          type="date"
          min={today}
          value={payday}
          onChange={(e) => setPayday(e.target.value)}
          className="h-14 rounded-[14px] bg-input px-4 text-[17px] font-medium outline-none focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]"
        />
      </label>
      {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
      <div className="flex gap-2">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" busy={saving} disabled={!payday} className="flex-1">
          Save schedule
        </Button>
      </div>
    </form>
  )
}
