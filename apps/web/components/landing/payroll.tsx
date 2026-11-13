"use client"

// Payroll (DESIGN.md "The landing page" §7): a run that plays itself once it is on screen. People arrive (Magic UI
// animated list), one hold fills, every row turns Paid in the same transaction, and the business seal presses.
// The three destinations are the three the app offers: a Tegata account, a NEAR account, a coin on another chain.
import { Check, FileSpreadsheet, Mail, RotateCcw, ShieldCheck, Timer } from "lucide-react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { GRAIN, Paper } from "@/components/kit/stage"
import { Mark } from "@/components/marks/mark"
import { AnimatedList } from "@/components/ui/animated-list"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

import { Rise, RunningHead, SectionTitle } from "./section"

type Phase = "adding" | "holding" | "paid"

const PEOPLE = [
  {
    role: "Designer",
    to: "Their Tegata account",
    mark: <TegataSeal size={30} textured={false} />,
    amount: 1800,
  },
  { role: "Developer", to: "Their NEAR account", mark: <Mark id="near" size={30} />, amount: 2400 },
  {
    role: "Writer",
    to: "USDT on Tron, in Live",
    mark: <Mark id="usdt" chain="tron" size={30} />,
    amount: 980,
  },
]
const TOTAL = PEOPLE.reduce((s, p) => s + p.amount, 0)
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`

function Row({
  person,
  paid,
  index,
}: {
  person: (typeof PEOPLE)[number]
  paid: boolean
  index: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-paper-sunk px-3 py-3">
      <span className="grid size-10 shrink-0 place-items-center">{person.mark}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">{person.role}</span>
        <span className="truncate text-[13px] text-paper-text-2">{person.to}</span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="figure text-[22px]">{money(person.amount)}</span>
        <AnimatePresence initial={false} mode="wait">
          {paid ? (
            <motion.span
              key="paid"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08, type: "spring", stiffness: 520, damping: 26 }}
              className="inline-flex items-center gap-1 rounded-full bg-[#EEF9DC] px-2 py-0.5 text-[12px] font-semibold text-[#2F7A00]"
            >
              <Check className="size-3" strokeWidth={3} /> Paid
            </motion.span>
          ) : (
            <motion.span
              key="ready"
              exit={{ opacity: 0 }}
              className="rounded-full bg-paper-rule px-2 py-0.5 text-[12px] font-semibold text-paper-text-2"
            >
              Ready
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  )
}

function Run() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.45 })
  const reduce = useReducedMotion()
  const [round, setRound] = useState(0)
  const [started, setStarted] = useState(false)
  const [phase, setPhase] = useState<Phase>("adding")

  useEffect(() => {
    if (inView && !started) setStarted(true)
  }, [inView, started])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `round` replays the run when Play again is pressed.
  useEffect(() => {
    if (!started) return
    if (reduce) {
      setPhase("paid")
      return
    }
    setPhase("adding")
    const timers = [
      window.setTimeout(() => setPhase("holding"), 2000),
      window.setTimeout(() => setPhase("paid"), 3700),
    ]
    return () => {
      for (const t of timers) window.clearTimeout(t)
    }
  }, [started, round, reduce])

  return (
    <div ref={ref} className="relative isolate overflow-hidden rounded-[32px] bg-kin p-4 sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.25] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
      <Paper className="relative mx-auto w-full max-w-[460px] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold text-paper-text-2">
              Payroll · payday today
            </span>
            <span className="figure mt-1 text-[48px] leading-none">{money(TOTAL)}</span>
            <span className="mt-1 text-[13px] text-paper-text-2">
              to 3 people, each where they chose
            </span>
          </span>
          <div className="relative size-[88px] shrink-0">
            {phase === "paid" ? (
              <SealPress play={!reduce} onLanded={() => fire("confirm")}>
                <BusinessSeal name="Your business" band="Paid" size={88} />
              </SealPress>
            ) : null}
          </div>
        </div>

        <div className="mt-5 min-h-[226px]">
          {started ? (
            <AnimatedList key={round} delay={reduce ? 0 : 520} className="gap-2">
              {PEOPLE.map((p, i) => (
                <Row key={p.role} person={p} index={i} paid={phase === "paid"} />
              ))}
            </AnimatedList>
          ) : null}
        </div>

        <div className="relative mt-4 h-14 overflow-hidden rounded-[14px] bg-[#16130F] text-[#FFFCF6]">
          <motion.span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-shu"
            initial={false}
            animate={{ width: phase === "adding" ? "0%" : "100%" }}
            transition={{ duration: phase === "holding" ? 1.5 : 0.2, ease: "linear" }}
          />
          <span className="relative z-10 flex h-full items-center justify-center gap-2 text-[16px] font-semibold">
            {phase === "paid" ? (
              <>
                <Check className="size-5" strokeWidth={3} /> Paid in one transaction on NEAR
              </>
            ) : (
              <>Hold to pay 3 people · {money(TOTAL)}</>
            )}
          </span>
        </div>
      </Paper>
      <button
        type="button"
        onClick={() => {
          fire("tick")
          setRound((r) => r + 1)
        }}
        className={cn(
          "absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1.5 text-[13px] font-semibold text-foreground transition-opacity hover:bg-foreground/15",
          phase === "paid" ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <RotateCcw className="size-3.5" /> Play again
      </button>
    </div>
  )
}

/** `pill` marks a fact that is Sandbox-only (none today: autopilot and team treasuries both run on Live). */
const FACTS: { icon: React.ReactNode; title: string; detail: string; pill?: string }[] = [
  {
    icon: <Mail />,
    title: "Add people by email or CSV",
    detail:
      "Each person gets a page where they choose where their pay lands. A row with a mistake says which line and why.",
  },
  {
    icon: <Check />,
    title: "One hold pays everyone",
    detail:
      "Up to 50 people in a single all-or-nothing transaction on NEAR, with a payslip each by email.",
  },
  {
    icon: <ShieldCheck />,
    title: "Team approvals",
    detail:
      "Need two of three to sign off? Pay waits in a team treasury on NEAR and goes out only when enough approvers say yes, each with their own key.",
  },
  {
    icon: <Timer />,
    title: "Autopilot",
    detail: "Set money aside and Tegata's contract pays on payday with nobody online.",
  },
  {
    icon: <FileSpreadsheet />,
    title: "In the books",
    detail: "Every payslip, payout and fee in Activity, the monthly CSV and the statement.",
  },
]

export function Payroll() {
  return (
    <section
      id="payroll"
      className="mx-auto max-w-[1240px] scroll-mt-24 px-5 pt-24 sm:px-8 lg:pt-32"
    >
      <RunningHead n="04" label="Paying your team" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <Run />
        <div className="flex flex-col gap-8 lg:order-first lg:col-start-2 lg:row-start-1">
          <SectionTitle className="max-w-[12ch]">
            Payday is <span className="text-text-3">one approval.</span>
          </SectionTitle>
          <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-1">
            {FACTS.map((f, i) => (
              <Rise
                as="li"
                key={f.title}
                delay={i * 0.05}
                className="flex gap-4 sm:max-lg:[&:nth-child(odd):last-child]:col-span-2"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-card [&_svg]:size-5">
                  {f.icon}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-[17px] font-semibold">
                    {f.title}
                    {f.pill ? (
                      <span className="rounded-full border border-dashed border-rule px-2 py-0.5 text-[12px] font-semibold text-muted-foreground">
                        {f.pill}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[15px] leading-[1.5] text-muted-foreground">
                    {f.detail}
                  </span>
                </span>
              </Rise>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
