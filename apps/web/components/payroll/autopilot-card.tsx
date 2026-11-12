"use client"

// Autopilot on the Payroll page (plan 6.8 T): off (a sora card that says what it does), being set up (steps on NEAR),
// on (a stage tile with the contract's own numbers), paused, underfunded, and money still set aside after it's off.
// The setup sheet lists who it pays, the paydays at 09:00 local, and how much to set aside. Separate from its logic so
// /dev/flows can show every state.
import {
  CalendarClock,
  ExternalLink,
  KeyRound,
  Pause,
  Play,
  Plus,
  Power,
  Undo2,
} from "lucide-react"
import { useEffect, useState } from "react"

import { CustomerDisc } from "@/components/invoices/customer-picker"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { HoldButton } from "@/components/kit/hold-button"
import { Segmented } from "@/components/kit/segmented"
import { Stage } from "@/components/kit/stage"
import { LoadingShape, StatusPill } from "@/components/kit/states"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark } from "@/components/marks/mark"
import { DestinationMark } from "@/components/people/destination"
import { Sheet } from "@/components/shell/sheet"
import type { AutopilotPreview, AutopilotView } from "@/lib/client/types"

import { money } from "./payroll-view"

export type AutopilotAction = "pause" | "resume" | "off" | "withdraw" | "add"

/** "Fri 28 Nov, 09:00" in the business's own time zone, where paydays are set. */
export const dueText = (ms: number, timeZone?: string) =>
  new Date(ms).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  })

const SETUP_STEPS = [
  {
    id: "ready",
    label: "Getting autopilot ready on NEAR",
    detail: "Tegata pays for its storage",
    mark: "near" as const,
  },
  {
    id: "sign",
    label: "Approved with your key",
    detail: "two actions, signed together",
    icon: <KeyRound />,
  },
  {
    id: "on",
    label: "Plan created on NEAR",
    detail: "the money is set aside",
    mark: "usdc" as const,
  },
]

export function AutopilotCard({
  view,
  canSetUp,
  busy,
  problem,
  onSetUp,
  onAction,
}: {
  view: AutopilotView | undefined
  /** A schedule and at least one ready person. */
  canSetUp: boolean
  busy: boolean
  problem: string | null
  onSetUp: () => void
  onAction: (action: AutopilotAction, amount?: string) => void
}) {
  const [amount, setAmount] = useState("")
  const [mode, setMode] = useState<"add" | "withdraw" | null>(null)
  if (!view) return <LoadingShape shape="card" className="h-[150px] rounded-[24px]" />

  const row = view.row
  const funds = view.funds
  const setAside = funds ? BigInt(funds.available) + BigInt(funds.reserved) : 0n
  const leftOver = !row && funds && BigInt(funds.available) > 0n

  const amountForm = mode ? (
    <form
      className="flex flex-col gap-2 rounded-[16px] bg-white/95 p-3 text-black"
      onSubmit={(e) => {
        e.preventDefault()
        if (amount.trim()) onAction(mode, amount.trim())
      }}
    >
      <Field
        id="autopilot-amount"
        aria-label={mode === "add" ? "Amount to add" : "Amount to withdraw"}
        inputMode="decimal"
        placeholder={mode === "add" ? "How much to set aside" : "How much to take back"}
        leading={<span className="text-[17px] font-semibold text-text-3">$</span>}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setMode(null)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" busy={busy} disabled={!amount.trim()}>
          {mode === "add" ? "Add to autopilot" : "Withdraw to balance"}
        </Button>
      </div>
    </form>
  ) : null

  if (!row) {
    return (
      <section className="flex flex-col gap-4 rounded-[24px] bg-sora p-6 text-black">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-white [&_svg]:size-6">
            <CalendarClock />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="display text-[28px] leading-none">Autopilot</h2>
            <p className="max-w-[52ch] text-[15px] text-black/75">
              Pays your team on payday even with everyone offline. You set dollars aside in Tegata's
              contract on NEAR; it pays each payday by itself and confirms every row.
            </p>
          </div>
        </div>
        {leftOver ? (
          <div className="flex flex-col gap-2 rounded-[16px] bg-white/70 p-3">
            <span className="text-[15px] font-semibold">
              {money(funds.available)} is still set aside from before.
            </span>
            {amountForm ?? (
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => setMode("withdraw")}
              >
                <Undo2 /> Withdraw to balance
              </Button>
            )}
          </div>
        ) : null}
        {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="md" disabled={!canSetUp || busy} onClick={onSetUp}>
            Set up autopilot
          </Button>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-black/70">
            <Mark id="near" size={18} /> {view.contract}
          </span>
        </div>
        {!canSetUp ? (
          <p className="text-[14px] text-black/70">
            Needs a payday and at least one person who is ready.
          </p>
        ) : null}
      </section>
    )
  }

  if (row.status === "failed") {
    return (
      <section className="flex flex-col gap-3 rounded-[24px] bg-down-surface p-6">
        <span className="text-[17px] font-semibold">Autopilot didn't turn on</span>
        <p className="text-[15px] text-muted-foreground">
          {row.error ?? "NEAR didn't accept it."} Nothing is set aside unless the first step landed;
          if it did, it shows here once you set up again.
        </p>
        <Button variant="secondary" size="md" className="self-start" onClick={onSetUp}>
          Set up again
        </Button>
      </section>
    )
  }

  if (row.status !== "on") {
    const current = row.status === "preparing" ? 0 : row.status === "ready" ? 1 : 2
    return (
      <section className="flex flex-col gap-3 rounded-[24px] bg-card p-6">
        <span className="text-[17px] font-semibold">Turning autopilot on</span>
        <div className="rounded-[20px] bg-secondary p-2">
          <TaskSteps steps={SETUP_STEPS} current={current} />
        </div>
        {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
      </section>
    )
  }

  const plan = view.plan
  const paused = plan?.status === "Paused"
  const finished = plan?.status === "Finished"
  const next = plan && plan.next < plan.due.length ? plan.due[plan.next] : undefined
  const left = plan ? plan.due.length - plan.next : 0
  const total = BigInt(row.total)
  const covers = total > 0n ? Number(setAside / total) : 0
  return (
    <section className="flex flex-col gap-3">
      <Stage className="p-6 sm:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-white">
              <CalendarClock className="size-5" />{" "}
              {paused ? "Autopilot paused" : finished ? "Autopilot done" : "Autopilot on"}
            </span>
            <a
              href={view.contractUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white hover:bg-white/25"
            >
              <Mark id="near" size={16} /> {view.contract} <ExternalLink className="size-3.5" />
            </a>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-medium text-white/85">Set aside on NEAR</span>
            <Figure value={viewDollars(setAside)} className="text-[56px] text-white" />
            <span className="text-[15px] font-medium text-white/85">
              {money(total)} a payday to {row.rows.length}{" "}
              {row.rows.length === 1 ? "person" : "people"} · covers {covers} of {left}{" "}
              {left === 1 ? "payday" : "paydays"} left
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Fact
              label="Next run"
              value={next && !paused ? dueText(next) : paused ? "Paused" : "None left"}
            />
            <Fact label="Paydays left" value={String(left)} />
            <Fact
              label="Last payday"
              value={
                plan?.lastPaid || plan?.lastFailed
                  ? `${plan.lastPaid} paid · ${plan.lastFailed} returned`
                  : "Not yet"
              }
            />
          </div>
          {amountForm ?? (
            <div className="flex flex-wrap gap-2">
              <Button variant="paper" size="sm" disabled={busy} onClick={() => setMode("add")}>
                <Plus /> Add money
              </Button>
              {finished ? null : paused ? (
                <Button variant="paper" size="sm" busy={busy} onClick={() => onAction("resume")}>
                  <Play /> Resume
                </Button>
              ) : (
                <Button variant="paper" size="sm" busy={busy} onClick={() => onAction("pause")}>
                  <Pause /> Pause
                </Button>
              )}
              <Button variant="paper" size="sm" disabled={busy} onClick={() => setMode("withdraw")}>
                <Undo2 /> Withdraw
              </Button>
              <Button variant="paper" size="sm" busy={busy} onClick={() => onAction("off")}>
                <Power /> Turn off
              </Button>
            </div>
          )}
        </div>
      </Stage>
      {row.underfunded ? (
        <p className="rounded-[14px] bg-warn-surface px-4 py-3 text-[15px] font-medium text-warn">
          The payday on {row.underfunded.payday} needs {money(row.underfunded.needed)} and{" "}
          {money(row.underfunded.available)} is set aside. Add money and it runs within a minute.
        </p>
      ) : null}
      {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col rounded-[14px] bg-white/15 px-3 py-2">
      <span className="text-[12px] font-medium text-white/75">{label}</span>
      <span className="text-[15px] font-semibold text-white">{value}</span>
    </span>
  )
}

export function AutopilotSheet({
  open,
  onOpenChange,
  preview,
  count,
  onCount,
  balance,
  busy,
  problem,
  onTurnOn,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: AutopilotPreview | undefined
  count: number
  onCount: (count: number) => void
  balance: string | null
  busy: boolean
  problem: string | null
  onTurnOn: (setAside: string) => void
}) {
  const total = preview ? BigInt(preview.total) : 0n
  const [setAside, setSetAside] = useState("")
  useEffect(() => {
    if (preview) setSetAside(viewDollars(preview.total).toFixed(2))
  }, [preview])
  const units =
    BigInt(Math.round((Number.parseFloat(setAside.replaceAll(",", "")) || 0) * 100)) * 10_000n
  const covers = total > 0n ? Number(units / total) : 0
  const short = balance !== null && BigInt(balance) < units
  const valid =
    preview && units >= total && units <= total * BigInt(preview.paydays.length) && !short

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Set up autopilot">
      {!preview ? (
        <LoadingShape shape="list" />
      ) : (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <span className="text-detail font-medium text-muted-foreground">Who it pays</span>
            <div className="flex flex-col rounded-[16px] bg-secondary p-1.5">
              {preview.rows.map((row) => (
                <div
                  key={row.personId}
                  className="flex items-center gap-3 rounded-[12px] px-2 py-2"
                >
                  <CustomerDisc name={row.name} size={34} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold">{row.name}</span>
                    <span className="flex items-center gap-1 truncate font-mono text-[12px] text-muted-foreground">
                      <DestinationMark kind={row.destinationKind} size={13} /> {row.accountId}
                    </span>
                  </span>
                  <span className="tnum text-[15px] font-semibold">{money(row.amount)}</span>
                </div>
              ))}
            </div>
            {preview.left.length ? (
              <p className="text-[14px] text-muted-foreground">
                Not in autopilot:{" "}
                {preview.left.map((l) => `${l.name} (${l.reason.toLowerCase()})`).join(", ")}.
              </p>
            ) : null}
          </section>

          <section className="flex flex-col gap-2">
            <span className="text-detail font-medium text-muted-foreground">
              Paydays, at 09:00 ({preview.timezone})
            </span>
            <Segmented
              label="How many paydays"
              value={String(count)}
              onValueChange={(v) => onCount(Number(v))}
              options={[3, 6, 12].map((n) => ({ value: String(n), label: `Next ${n}` }))}
            />
            <div className="flex flex-wrap gap-1.5">
              {preview.dueMs.map((ms) => (
                <StatusPill key={ms} tone="wait">
                  {dueText(ms, preview.timezone)}
                </StatusPill>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <Field
              id="autopilot-set-aside"
              label="Set aside now"
              inputMode="decimal"
              leading={<span className="text-[17px] font-semibold text-text-3">$</span>}
              value={setAside}
              onChange={(e) => setSetAside(e.target.value)}
              status={
                short
                  ? { kind: "bad", text: "More than your balance" }
                  : {
                      kind: "ok",
                      text: `${money(total)} a payday · covers ${covers} of ${preview.paydays.length}`,
                    }
              }
            />
            <p className="text-[14px] text-muted-foreground">
              You can add more later. If a payday isn't covered, it waits until it is and nothing is
              sent.
            </p>
          </section>

          {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
          <HoldButton
            label={`Hold to turn on autopilot · ${money(units)}`}
            ready={Boolean(valid)}
            busy={busy}
            onConfirm={() => onTurnOn(setAside)}
          />
          <p className="-mt-2 text-center text-detail text-muted-foreground">
            Two gas-free actions, signed together: set the money aside, then create the plan.
          </p>
        </div>
      )}
    </Sheet>
  )
}
