"use client"

// Built on NEAR (DESIGN.md "The landing page" §11): who uses Tegata on the left, the NEAR pieces it is made of on
// the right, the seal in the middle, joined by Magic UI animated beams; the licensed partners sit at the edge.
import { CalendarClock, Mail, PenLine, UsersRound, Wallet } from "lucide-react"
import { useRef } from "react"

import { TegataSeal } from "@/components/brand/seal"
import { Mark } from "@/components/marks/mark"
import { AnimatedBeam } from "@/components/ui/animated-beam"
import { cn } from "@/lib/utils"

import { Rise, RunningHead, SectionTitle } from "./section"

const PEOPLE = [
  { key: "owner", label: "The owner", sub: "signs in with email", icon: <Mail /> },
  {
    key: "customer",
    label: "Customers",
    sub: "pay from any chain",
    icon: <Mark id="usdt" chain="tron" size={30} />,
  },
  { key: "team", label: "The team", sub: "paid where they choose", icon: <UsersRound /> },
]

const PIECES = [
  {
    key: "accounts",
    label: "Named accounts",
    sub: "studio.tegata.near",
    icon: <Mark id="near" size={30} />,
  },
  {
    key: "meta",
    label: "Meta transactions",
    sub: "NEP-366, fees paid by Tegata",
    icon: <PenLine />,
  },
  {
    key: "usdc",
    label: "USDC",
    sub: "NEP-141, decides what's paid",
    icon: <Mark id="usdc" size={30} />,
  },
  {
    key: "intents",
    label: "NEAR Intents",
    sub: "1Click, in and out of 11 routes",
    icon: <Mark id="intents" size={30} />,
  },
  { key: "connect", label: "NEAR Connect", sub: "wallet sign-in and approvals", icon: <Wallet /> },
  {
    key: "autopilot",
    label: "Autopilot contract",
    sub: "pays payroll on schedule",
    icon: <CalendarClock />,
  },
]

const EDGE = [
  { name: "Noah", what: "bank payouts and euro accounts" },
  { name: "Bitnob", what: "virtual Visa cards" },
  { name: "Transak", what: "card payments in" },
]

function Node({
  nodeRef,
  label,
  sub,
  icon,
  align,
}: {
  nodeRef: React.RefObject<HTMLDivElement | null>
  label: string
  sub: string
  icon: React.ReactNode
  align: "left" | "right"
}) {
  return (
    <div
      className={cn("flex items-center gap-3", align === "right" && "flex-row-reverse text-right")}
    >
      <div
        ref={nodeRef}
        className="relative z-10 grid size-14 shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_0_0_6px_rgba(255,255,255,0.08)] [&_svg]:size-6"
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold text-white">{label}</span>
        <span className="text-[13px] text-white/60">{sub}</span>
      </div>
    </div>
  )
}

export function BuiltOnNear() {
  const container = useRef<HTMLDivElement>(null)
  const centre = useRef<HTMLDivElement>(null)
  const p0 = useRef<HTMLDivElement>(null)
  const p1 = useRef<HTMLDivElement>(null)
  const p2 = useRef<HTMLDivElement>(null)
  const q0 = useRef<HTMLDivElement>(null)
  const q1 = useRef<HTMLDivElement>(null)
  const q2 = useRef<HTMLDivElement>(null)
  const q3 = useRef<HTMLDivElement>(null)
  const q4 = useRef<HTMLDivElement>(null)
  const q5 = useRef<HTMLDivElement>(null)
  const left = [p0, p1, p2]
  const right = [q0, q1, q2, q3, q4, q5]

  return (
    <section id="near" className="scroll-mt-24 px-3 pt-24 sm:px-6 lg:pt-32">
      <div className="relative isolate mx-auto max-w-[1300px] overflow-hidden rounded-[32px] bg-ai px-5 py-14 text-white sm:px-10 lg:px-14 lg:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1/3 left-1/2 -z-10 aspect-square w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-[100px]"
          style={{ background: "radial-gradient(closest-side, #00EC97 0%, transparent 70%)" }}
        />
        <RunningHead n="08" label="Built on NEAR" tone="night" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <SectionTitle className="max-w-[14ch]">
            Made of NEAR. <span className="text-white/50">You never touch crypto.</span>
          </SectionTitle>
          <Rise className="max-w-[40ch] text-[17px] text-white/70 lg:pb-2">
            Every balance, payment and payout is USDC on NEAR. Tegata relays every action, so no one
            ever buys NEAR or keeps a seed phrase.
          </Rise>
        </div>

        <div
          ref={container}
          className="relative mt-14 grid grid-cols-1 gap-10 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-6"
        >
          <div className="flex flex-col gap-8 md:gap-14">
            {PEOPLE.map((p, i) => (
              <Node
                key={p.key}
                nodeRef={left[i]!}
                label={p.label}
                sub={p.sub}
                icon={p.icon}
                align="left"
              />
            ))}
          </div>
          <div className="flex justify-center">
            <div
              ref={centre}
              className="relative z-10 grid size-32 place-items-center rounded-[28px] bg-white shadow-[0_0_0_10px_rgba(255,255,255,0.08),0_0_80px_20px_rgba(255,79,0,0.35)]"
            >
              <TegataSeal size={92} />
            </div>
          </div>
          <div className="flex flex-col gap-6">
            {PIECES.map((p, i) => (
              <Node
                key={p.key}
                nodeRef={right[i]!}
                label={p.label}
                sub={p.sub}
                icon={p.icon}
                align="right"
              />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-0 hidden md:block">
            {left.map((r, i) => (
              <AnimatedBeam
                key={PEOPLE[i]!.key}
                containerRef={container}
                fromRef={r}
                toRef={centre}
                curvature={(i - 1) * -40}
                pathColor="#ffffff"
                pathOpacity={0.14}
                pathWidth={2}
                gradientStartColor="#FF4F00"
                gradientStopColor="#FFD23F"
                duration={4}
                delay={i * 0.5}
              />
            ))}
            {right.map((r, i) => (
              <AnimatedBeam
                key={PIECES[i]!.key}
                containerRef={container}
                fromRef={centre}
                toRef={r}
                curvature={(i - 2.5) * 22}
                pathColor="#ffffff"
                pathOpacity={0.14}
                pathWidth={2}
                gradientStartColor="#FFD23F"
                gradientStopColor="#00EC97"
                duration={4}
                delay={1.2 + i * 0.3}
              />
            ))}
          </div>
        </div>

        <Rise className="mt-14 flex flex-col gap-4 border-t border-white/15 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <span className="text-[15px] font-semibold text-white/80">
            At the edge, only where a licence is needed, crypto-native partners:
          </span>
          <div className="flex flex-wrap gap-2">
            {EDGE.map((e) => (
              <span key={e.name} className="rounded-full bg-white/10 px-3 py-1.5 text-[14px]">
                <span className="font-semibold">{e.name}</span>
                <span className="text-white/60"> · {e.what}</span>
              </span>
            ))}
          </div>
        </Rise>
      </div>
    </section>
  )
}
