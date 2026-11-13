"use client"

import { ArrowRight, Link2, Plus, Send } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { CodeField, type CodeState } from "@/components/kit/code-field"
import { Field, type FieldStatus } from "@/components/kit/field"
import { HoldButton } from "@/components/kit/hold-button"
import { Segmented } from "@/components/kit/segmented"
import { StatusPill } from "@/components/kit/states"
import { Switch } from "@/components/kit/switch"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"

import { Section, Specimen } from "../dev-chrome"

const STEPS = [
  {
    id: "account",
    label: "Creating abu-studio.tegata.near",
    detail: "on NEAR",
    mark: "near" as const,
  },
  {
    id: "usdc",
    label: "Registering it for USDC",
    detail: "Circle's USDC on NEAR",
    mark: "usdc" as const,
  },
  { id: "seal", label: "Cutting your seal", detail: "from your business name", icon: <Plus /> },
]

const FIELD_STATES: { label: string; status: FieldStatus; value: string }[] = [
  { label: "Empty", status: { kind: "none" }, value: "" },
  { label: "Checking", status: { kind: "checking" }, value: "abu-studio" },
  { label: "Available", status: { kind: "ok", text: "Available" }, value: "abu-studio" },
  { label: "Taken", status: { kind: "bad", text: "Taken. Try abu-studio-co" }, value: "abu" },
]

export default function KitPage() {
  const [seg, setSeg] = useState("week")
  const [on, setOn] = useState(true)
  const [code, setCode] = useState("")
  const [codeState, setCodeState] = useState<CodeState>("idle")
  const [step, setStep] = useState(1)
  const [failed, setFailed] = useState(false)
  const [held, setHeld] = useState(0)

  return (
    <div className="flex flex-col">
      <Section
        title="Buttons"
        note="56 high, 14 px corners, a 0.97 press. Main actions play a soft tap."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Specimen label="Variants">
            <div className="flex flex-wrap gap-3">
              <Button cue="tap">
                Send invoice <ArrowRight />
              </Button>
              <Button variant="secondary">Copy link</Button>
              <Button variant="shu" cue="tap">
                Create pay link
              </Button>
              <Button variant="ghost">Later</Button>
              <Button variant="destructive">Void invoice</Button>
            </div>
          </Specimen>
          <Specimen label="Sizes and states">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="md">Medium</Button>
              <Button size="sm" variant="secondary">
                Small
              </Button>
              <Button busy>Sending</Button>
              <Button disabled>Add an amount</Button>
              <Button size="icon" variant="secondary" aria-label="Send">
                <Send />
              </Button>
            </div>
          </Specimen>
        </div>
      </Section>

      <Section
        title="Fields"
        note="56 px plates, a vermilion ring on focus, and a status line that says what the field knows."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {FIELD_STATES.map((f) => (
            <Specimen key={f.label} label={f.label}>
              <Field
                id={`f-${f.label}`}
                defaultValue={f.value}
                placeholder="your-business"
                status={f.status}
                reserveStatus
                trailing={<span className="font-mono text-[15px] text-text-3">.tegata.near</span>}
              />
            </Specimen>
          ))}
          <Specimen label="Email with an inline action (Privy's pattern)">
            <Field
              id="f-email"
              type="email"
              placeholder="you@business.com"
              trailing={
                <Button size="iconSm" aria-label="Email me a code">
                  <ArrowRight />
                </Button>
              }
            />
          </Specimen>
        </div>
      </Section>

      <Section
        title="Email code"
        note="Six cells. Wrong code: the row shakes. Accepted: the cells fill vermilion one by one."
      >
        <Specimen label="Try it">
          <CodeField
            value={code}
            state={codeState}
            onChange={(v) => {
              setCode(v)
              if (codeState === "wrong") setCodeState("idle")
            }}
            autoFocus={false}
            onComplete={() => setCodeState("checking")}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setCodeState("wrong")
                fire("fail", { cue: "error" })
              }}
            >
              Show wrong
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setCode("482913")
                setCodeState("accepted")
                fire("filled", { cue: "confirmed" })
              }}
            >
              Show accepted
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCode("")
                setCodeState("idle")
              }}
            >
              Reset
            </Button>
          </div>
        </Specimen>
      </Section>

      <Section title="Controls">
        <div className="grid gap-4 md:grid-cols-3">
          <Specimen label="Segmented">
            <Segmented
              label="Period"
              value={seg}
              onValueChange={setSeg}
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]}
            />
          </Specimen>
          <Specimen label="Switch">
            <div className="flex items-center justify-between rounded-[14px] bg-secondary px-4 py-3">
              <span className="text-[16px] font-medium">Email receipts</span>
              <Switch checked={on} onCheckedChange={setOn} label="Email receipts" />
            </div>
          </Specimen>
          <Specimen label="Status">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="up">Paid</StatusPill>
              <StatusPill tone="wait">Waiting</StatusPill>
              <StatusPill tone="warn">Overdue</StatusPill>
              <StatusPill tone="down">Failed</StatusPill>
              <StatusPill tone="shu">Sandbox</StatusPill>
              <StatusPill tone="quiet">Draft</StatusPill>
            </div>
          </Specimen>
        </div>
      </Section>

      <Section
        title="Hold to approve"
        note="Hold for 1.2 s; let go early and it drains. Used for payroll and sends."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Specimen label="Ready">
            <HoldButton
              label="Hold to pay 4 people · $9,600.00"
              onConfirm={() => setHeld((n) => n + 1)}
            />
            <span className="text-meta text-muted-foreground">Approved {held} times</span>
          </Specimen>
          <Specimen label="Blocked (the label names the fix)">
            <HoldButton
              label="Add $2,400 to pay everyone"
              ready={false}
              onConfirm={() => undefined}
            />
          </Specimen>
        </div>
      </Section>

      <Section
        title="Task steps"
        note="Each finished step ticks with a sound. The one in flight shimmers."
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <Specimen label="Opening an account">
            <TaskSteps steps={STEPS} current={step} failed={failed} />
          </Specimen>
          <div className="flex flex-col gap-2 rounded-[20px] bg-card p-5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setFailed(false)
                setStep((s) => Math.min(STEPS.length, s + 1))
              }}
            >
              Next step
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setFailed(true)}>
              Fail this step
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFailed(false)
                setStep(0)
              }}
            >
              Restart
            </Button>
          </div>
        </div>
      </Section>

      <Section
        title="Rows"
        note="Rows, not boxes: a real mark, a title, a detail and a signed amount."
      >
        <div className="flex flex-col rounded-[20px] bg-card p-2">
          {[
            {
              mark: "base",
              coin: "usdc",
              title: "Paid · Invoice 0042",
              detail: "From Base · 2 min ago",
              amount: "+$1,250.00",
              up: true,
            },
            {
              mark: "tron",
              coin: "usdt",
              title: "Paid · Pay link Design sprint",
              detail: "From Tron · 1 h ago",
              amount: "+$480.00",
              up: true,
            },
            {
              mark: "near",
              coin: "usdc",
              title: "Payroll · 4 people",
              detail: "On NEAR · yesterday",
              amount: "−$9,600.00",
              up: false,
            },
          ].map((r) => (
            <div
              key={r.title}
              className="press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
            >
              <Mark id={r.coin} chain={r.mark} size={40} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[16px] font-semibold">{r.title}</span>
                <span className="truncate text-detail text-muted-foreground">{r.detail}</span>
              </div>
              <span
                className={
                  r.up ? "tnum text-[16px] font-semibold text-up" : "tnum text-[16px] font-semibold"
                }
              >
                {r.amount}
              </span>
            </div>
          ))}
        </div>
        <Button variant="ghost" className="self-start">
          <Link2 /> Every row opens its payment
        </Button>
      </Section>
    </div>
  )
}
