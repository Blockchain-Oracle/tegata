"use client"

// The sign-in story (plan 6.8 A; Kawase's StoryPager behaviour on Privy's product stage): four scenes, each built
// from real Tegata objects and real chain marks floating on the lit stage. Auto-advances every few seconds, pauses on
// hover, a tap on the left third goes back. Every amount is labelled "Example".
import { Check, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"

import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { Figure } from "@/components/kit/figure"
import { Paper, StageObject } from "@/components/kit/stage"
import { Mark, type MarkId } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { usd } from "@/lib/fiat"
import { cn } from "@/lib/utils"

const DWELL_MS = 5600

const SCENES = [
  { key: "link", title: "Send a link. Get paid in exact dollars." },
  { key: "payroll", title: "Pay your whole team in one approval." },
  { key: "address", title: "No wallet. No fees to think about." },
  { key: "receipt", title: "Every payment gets a sealed receipt." },
] as const

/** Steps a scene through its beats while it is on screen; reduced motion jumps to the last beat. */
function useBeats(beatsMs: readonly number[]) {
  const reduce = useReducedMotion()
  const [beat, setBeat] = useState(reduce ? beatsMs.length : 0)
  useEffect(() => {
    if (reduce) return
    const timers = beatsMs.map((ms, i) => setTimeout(() => setBeat(i + 1), ms))
    return () => timers.forEach(clearTimeout)
  }, [beatsMs, reduce])
  return beat
}

export function StoryStage({ sealed = false }: { sealed?: boolean }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduce = useReducedMotion()
  // biome-ignore lint/correctness/useExhaustiveDependencies: `index` restarts the dwell timer whenever the scene changes, by hand or by itself.
  useEffect(() => {
    if (paused || sealed || reduce) return
    const t = setTimeout(() => setIndex((i) => (i + 1) % SCENES.length), DWELL_MS)
    return () => clearTimeout(t)
  }, [index, paused, sealed, reduce])

  const go = (next: number) => {
    fire("tick", { cue: "scene" })
    setIndex((next + SCENES.length) % SCENES.length)
  }

  return (
    <div
      className="absolute inset-0 select-none"
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        {sealed ? (
          <motion.div
            key="sealed"
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <SealPress onLanded={() => fire("confirm", { cue: "stamp" })}>
              <TegataSeal size={180} tone="paper" tilt={-4} />
            </SealPress>
          </motion.div>
        ) : (
          <motion.div
            key={SCENES[index]!.key}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.24 } }}
          >
            <div className="absolute inset-x-0 top-14 bottom-[150px] grid place-items-center sm:top-12 sm:bottom-40 lg:top-10 lg:bottom-44">
              <div className="origin-center scale-[0.8] sm:scale-90 lg:scale-100">
                {index === 0 ? (
                  <LinkScene />
                ) : index === 1 ? (
                  <PayrollScene />
                ) : index === 2 ? (
                  <AddressScene />
                ) : (
                  <ReceiptScene />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!sealed ? (
        <div className="absolute inset-x-5 bottom-5 flex flex-col gap-4 sm:inset-x-8 sm:bottom-8 lg:inset-x-12 lg:bottom-12">
          <AnimatePresence mode="wait">
            <motion.p
              key={index}
              className="display max-w-[18ch] text-[28px] leading-[0.98] text-white sm:text-[40px] lg:text-[52px]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {SCENES[index]!.title}
            </motion.p>
          </AnimatePresence>
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1.5" role="tablist" aria-label="Story">
              {SCENES.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={s.title}
                  onClick={() => go(i)}
                  className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/30"
                >
                  {i < index ? <span className="absolute inset-0 bg-white" /> : null}
                  {i === index ? (
                    <motion.span
                      key={`${index}-${paused}`}
                      className="absolute inset-y-0 left-0 bg-white"
                      initial={{ width: "0%" }}
                      animate={{ width: paused || reduce ? "100%" : "100%" }}
                      transition={
                        paused || reduce
                          ? { duration: 0 }
                          : { duration: DWELL_MS / 1000, ease: "linear" }
                      }
                    />
                  ) : null}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                aria-label="Previous"
                onClick={() => go(index - 1)}
                className="press grid size-9 place-items-center rounded-full bg-white/18 text-white hover:bg-white/28"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => go(index + 1)}
                className="press grid size-9 place-items-center rounded-full bg-white/18 text-white hover:bg-white/28"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ExampleTag() {
  return (
    <span className="rounded-full bg-paper-sunk px-2 py-0.5 text-[11px] font-semibold text-paper-text-2">
      Example
    </span>
  )
}

const RING: { id: MarkId; chain?: MarkId; x: number; y: number; d: number }[] = [
  { id: "eth", x: -232, y: -112, d: 0.25 },
  { id: "usdc", chain: "base", x: 226, y: -128, d: 0.32 },
  { id: "sol", x: -262, y: 34, d: 0.39 },
  { id: "btc", x: 250, y: 22, d: 0.46 },
  { id: "usdt", chain: "tron", x: -190, y: 158, d: 0.53 },
  { id: "arb", x: 196, y: 160, d: 0.6 },
]

const LINK_BEATS = [1400, 2400, 2900] as const
const PAYROLL_BEATS = [900, 2100, 2350, 2600, 2850, 3300] as const
const RECEIPT_BEATS = [1300] as const

function LinkScene() {
  const beat = useBeats(LINK_BEATS)
  const paid = beat >= 2
  return (
    <div className="relative">
      {RING.map((m) => (
        <StageObject
          key={m.id + (m.chain ?? "")}
          delay={m.d}
          driftDelay={m.d * 3}
          className="absolute top-1/2 left-1/2 hidden md:block"
          from={{ scale: 0.4, y: 0 }}
        >
          <motion.div
            style={{ marginLeft: m.x - 28, marginTop: m.y - 28 }}
            animate={paid ? { opacity: 0.55, scale: 0.9 } : {}}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-max rounded-full bg-white p-1.5 shadow-object"
          >
            <Mark id={m.id} chain={m.chain} size={44} />
          </motion.div>
        </StageObject>
      ))}
      <StageObject from={{ y: 28, rotate: -3 }}>
        <Paper className="relative w-[280px] p-5 sm:w-[300px]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-paper-text-2">
              <TegataSeal size={18} textured={false} /> Pay link
            </span>
            <ExampleTag />
          </div>
          <p className="mt-3 text-[15px] font-semibold">Design sprint · Week 2</p>
          <Figure value={1250} className="mt-1 flex text-[48px]" />
          <div className="mt-3 flex h-9 items-center gap-2 rounded-[12px] bg-paper-sunk px-3 text-[14px] font-semibold">
            {paid ? (
              <>
                <Mark id="usdc" chain="near" size={22} />
                <span className="text-[#2F7A00]">Paid in USDC on NEAR</span>
              </>
            ) : (
              <>
                <span className="size-2 animate-pulse rounded-full bg-shu" />
                <span className="text-paper-text-2">Waiting for payment</span>
              </>
            )}
          </div>
          {beat >= 3 ? (
            <div className="absolute -right-8 -bottom-10">
              <SealPress>
                <BusinessSeal name="Studio Example" band="Paid" size={100} />
              </SealPress>
            </div>
          ) : null}
        </Paper>
      </StageObject>
    </div>
  )
}

const TEAM: { name: string; tone: string; to: MarkId; chain?: MarkId; amount: number }[] = [
  { name: "Mei", tone: "bg-sakura", to: "usdc", chain: "near", amount: 2400 },
  { name: "Kofi", tone: "bg-matcha", to: "usdt", chain: "tron", amount: 2400 },
  { name: "Sara", tone: "bg-sora", to: "usdc", chain: "base", amount: 2400 },
  { name: "Diego", tone: "bg-kin", to: "usdc", chain: "sol", amount: 2400 },
]

export function PayrollScene() {
  const beat = useBeats(PAYROLL_BEATS)
  const held = beat >= 1
  const paidRows = Math.max(0, beat - 2)
  return (
    <StageObject from={{ y: 28, rotate: 2 }}>
      {/* Four rows and the hold button are taller than the phone band leaves for an object: shrink it there. */}
      <Paper className="w-[300px] p-5 max-lg:scale-[0.8] sm:w-[340px]">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-paper-text-2">Payroll · November</span>
          <ExampleTag />
        </div>
        <div className="mt-3 flex flex-col gap-1">
          {TEAM.map((p, i) => (
            <div key={p.name} className="flex items-center gap-3 rounded-[12px] px-1 py-1.5">
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full text-[13px] font-bold text-black",
                  p.tone,
                )}
              >
                {p.name[0]}
              </span>
              <span className="flex-1 text-[15px] font-semibold">{p.name}</span>
              <Mark id={p.to} chain={p.chain} size={22} />
              <span className="tnum w-[84px] text-right text-[15px] font-semibold">
                {usd(p.amount)}
              </span>
              <span className="grid size-5 place-items-center">
                {i < paidRows ? (
                  <motion.span
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="grid size-5 place-items-center rounded-full bg-[#2F7A00] text-white"
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </motion.span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-3 grid h-12 place-items-center overflow-hidden rounded-[12px] bg-black text-[15px] font-semibold text-white">
          <span>
            {beat >= 6
              ? "Paid · one transaction on NEAR"
              : held
                ? "Keep holding…"
                : `Hold to pay 4 people · ${usd(9600)}`}
          </span>
          <motion.span
            className="absolute inset-0 grid place-items-center bg-shu text-black"
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: held ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
            transition={{ duration: 1.2, ease: "linear" }}
          >
            {beat >= 6 ? "Paid · one transaction on NEAR" : "Keep holding…"}
          </motion.span>
        </div>
      </Paper>
    </StageObject>
  )
}

function AddressScene() {
  const chips = ["No seed phrase", "No wallet app", "No network fees"]
  return (
    <div className="relative">
      <StageObject from={{ y: 28, rotate: -2 }}>
        <Paper className="w-[300px] p-5 sm:w-[330px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-paper-text-2">Your pay address</span>
            <ExampleTag />
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-[14px] bg-paper-sunk p-3">
            <Mark id="near" size={36} />
            <span className="font-mono text-[16px] font-medium">studio.tegata.near</span>
          </div>
          <div className="mt-3 flex flex-col divide-y divide-paper-rule text-[14px]">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-paper-text-2">Sign in</span>
              <span className="font-semibold">Email code</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-paper-text-2">Network fee</span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <TegataSeal size={16} textured={false} /> Paid by Tegata
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-paper-text-2">Holds</span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Mark id="usdc" chain="near" size={18} /> Dollars (USDC)
              </span>
            </div>
          </div>
        </Paper>
      </StageObject>
      {/* Beside the card where the stage is tall; on a phone band they would cover the lockup, and the card's own
          rows already say the same. */}
      <div className="absolute -top-14 -left-6 hidden flex-col gap-2 sm:-left-28 lg:flex">
        {chips.map((c, i) => (
          <StageObject key={c} delay={0.5 + i * 0.18} from={{ x: -20, y: 0 }} driftDelay={i}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-black shadow-object">
              <Check className="size-3.5 text-[#2F7A00]" strokeWidth={3} /> {c}
            </span>
          </StageObject>
        ))}
      </div>
    </div>
  )
}

function ReceiptScene() {
  const beat = useBeats(RECEIPT_BEATS)
  return (
    <StageObject from={{ y: 30, rotate: 3 }}>
      <div className="relative w-[290px] rounded-[18px] bg-white text-black shadow-object sm:w-[310px]">
        <div className="p-5 pb-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-paper-text-2">
              <TegataSeal size={20} textured={false} /> Receipt
            </span>
            <ExampleTag />
          </div>
          <Figure value={1250} className="mt-3 flex text-[46px]" />
          <div className="mt-3 flex items-center gap-2 text-[14px] font-semibold">
            <Mark id="usdc" chain="base" size={24} /> Base
            <span className="text-paper-text-3">→</span>
            <Mark id="near" size={24} /> NEAR
          </div>
        </div>
        <div className="relative h-4">
          <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-stage" />
          <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-stage" />
          <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-paper-rule" />
        </div>
        <div className="flex flex-col gap-2 p-5 pt-3 text-[13px]">
          <div className="flex justify-between">
            <span className="text-paper-text-2">Settled</span>
            <span className="font-semibold">12 Nov, 14:02</span>
          </div>
          <div className="flex justify-between">
            <span className="text-paper-text-2">Transaction</span>
            <span className="inline-flex items-center gap-1 font-mono font-medium">
              4a5U…qH6TX <ExternalLink className="size-3" />
            </span>
          </div>
        </div>
        {beat >= 1 ? (
          <div className="absolute -top-8 -right-10">
            <SealPress>
              <BusinessSeal name="Studio Example" band="Paid" size={96} />
            </SealPress>
          </div>
        ) : null}
      </div>
    </StageObject>
  )
}
