"use client"

// Before and after (DESIGN.md "The landing page" §4, FintechX's dial): one $1,250 invoice to a client abroad. The
// plate shows the usual way first; when it is on screen the dial turns to Tegata once, and either side can be
// chosen by hand. Every figure is the README's, with its source as a footnote.
import { Check } from "lucide-react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { TegataSeal } from "@/components/brand/seal"
import { Paper, Stage } from "@/components/kit/stage"
import { Mark } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

import { Note, RunningHead, SectionTitle } from "./section"

type Side = "usual" | "tegata"

const FEES = [
  {
    label: "Card from abroad",
    detail: "2.9% + 30¢, +1.5% international, +1% conversion",
    cost: 67.8,
    note: 1,
  },
  { label: "Card, same country", detail: "2.9% + 30¢", cost: 36.55, note: 1 },
  { label: "International wire", detail: "before the sender's own bank fee", cost: 6.11, note: 2 },
] as const

const BY_HAND = [
  "Ask which coin, and on which chain, they hold",
  "Send an address for exactly that chain, and hope they pick the right network",
  "Watch the wallet and match each transfer to an invoice by its amount",
  "Buy that chain's own token before the money can move again",
]

const TEGATA = [
  "One link. They pay from the coin they already hold",
  "NEAR Intents converts it, so exactly $1,250.00 arrives",
  "Paid only when NEAR's own USDC record shows it",
  "A numbered receipt, stamped with your seal",
]

export function BeforeAfter() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.55, once: true })
  const reduce = useReducedMotion()
  const [side, setSide] = useState<Side>("usual")
  const touched = useRef(false)

  useEffect(() => {
    if (!inView || touched.current) return
    const t = window.setTimeout(() => {
      if (!touched.current) setSide("tegata")
    }, 1400)
    return () => window.clearTimeout(t)
  }, [inView])

  const choose = (next: Side) => {
    touched.current = true
    if (next !== side) fire("tick", { cue: "toggle" })
    setSide(next)
  }

  return (
    <section
      id="problem"
      className="mx-auto max-w-[1240px] scroll-mt-24 px-5 pt-24 sm:px-8 lg:pt-32"
    >
      <RunningHead n="01" label="The problem" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <SectionTitle className="max-w-[14ch]">A $1,250 invoice to a client abroad.</SectionTitle>
        <p className="max-w-[40ch] text-[17px] text-muted-foreground lg:pb-2">
          Getting it in today is slow, expensive, or a job of its own. Turn the dial.
        </p>
      </div>

      {/* The dial. */}
      <div ref={ref} className="mt-10 flex items-center justify-center gap-2 sm:gap-6">
        <button
          type="button"
          onClick={() => choose("usual")}
          className={cn(
            "rounded-full px-3 py-2 text-[14px] font-semibold whitespace-nowrap transition-colors sm:px-4 sm:text-[15px]",
            side === "usual" ? "bg-card text-foreground" : "text-text-3 hover:text-foreground",
          )}
          aria-pressed={side === "usual"}
        >
          The usual way
        </button>
        <button
          type="button"
          onClick={() => choose(side === "usual" ? "tegata" : "usual")}
          aria-label={side === "usual" ? "Turn to Tegata" : "Turn to the usual way"}
          className="press relative grid size-[76px] place-items-center rounded-full bg-card shadow-[inset_0_-6px_12px_-6px_color-mix(in_oklab,var(--foreground)_25%,transparent),0_10px_24px_-12px_color-mix(in_oklab,var(--foreground)_40%,transparent)]"
        >
          <motion.span
            className="relative grid size-[58px] place-items-center rounded-full bg-background"
            animate={{ rotate: side === "usual" ? -50 : 50 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 18 }}
          >
            <span className="absolute top-1.5 h-3.5 w-1.5 rounded-full bg-shu" />
            <TegataSeal size={26} textured={false} />
          </motion.span>
        </button>
        <button
          type="button"
          onClick={() => choose("tegata")}
          className={cn(
            "rounded-full px-3 py-2 text-[14px] font-semibold whitespace-nowrap transition-colors sm:px-4 sm:text-[15px]",
            side === "tegata" ? "bg-card text-foreground" : "text-text-3 hover:text-foreground",
          )}
          aria-pressed={side === "tegata"}
        >
          With Tegata
        </button>
      </div>

      <div className="relative mt-8 min-h-[640px] sm:min-h-[520px] lg:min-h-[480px]">
        <AnimatePresence mode="wait" initial={false}>
          {side === "usual" ? (
            <motion.div
              key="usual"
              initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
              className="grid gap-3 rounded-[28px] bg-card p-5 sm:p-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10"
            >
              <div className="flex flex-col gap-2">
                <span className="text-[14px] font-semibold text-text-3">
                  What the business loses
                </span>
                {FEES.map((fee) => (
                  <div
                    key={fee.label}
                    className="flex flex-col gap-2 border-t border-rule py-4 first-of-type:border-0"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[17px] font-semibold">
                        {fee.label}
                        <Note n={fee.note} />
                      </span>
                      <span className="figure text-[34px] text-down">−${fee.cost.toFixed(2)}</span>
                    </div>
                    <span className="h-2.5 overflow-hidden rounded-full bg-secondary">
                      <motion.span
                        className="block h-full rounded-full bg-down"
                        initial={{ width: 0 }}
                        animate={{ width: `${(fee.cost / 67.8) * 100}%` }}
                        transition={{
                          duration: reduce ? 0 : 0.7,
                          ease: [0.22, 1, 0.36, 1],
                          delay: 0.15,
                        }}
                      />
                    </span>
                    <span className="text-[14px] text-muted-foreground">{fee.detail}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 rounded-[20px] bg-background p-5 sm:p-6">
                <span className="text-[14px] font-semibold text-text-3">
                  Or in stablecoins, by hand
                </span>
                <ol className="flex flex-col gap-3">
                  {BY_HAND.map((step, i) => (
                    <li key={step} className="flex gap-3 text-[16px] leading-snug">
                      <span className="figure grid size-8 shrink-0 place-items-center rounded-full bg-card text-[18px]">
                        {i + 1}
                      </span>
                      <span className="pt-1">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-auto pt-2 text-[14px] text-muted-foreground">
                  If they hold the wrong coin, someone swaps it by hand, and $1,250.00 arrives as
                  something less, with a hash instead of a receipt.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="tegata"
              initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <Stage
                className="rounded-[28px] p-5 sm:p-8"
                inner="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10"
              >
                <div className="flex flex-col gap-3">
                  <span className="text-[15px] font-semibold text-white/85">
                    What the business receives
                  </span>
                  <p className="figure text-[clamp(84px,13vw,168px)] leading-[0.86]">$1,250.00</p>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[14px] font-semibold text-black">
                    <Mark id="usdc" chain="near" size={22} /> Exactly, in USDC on NEAR
                  </span>
                  <span className="text-[15px] text-white/85">
                    Tegata takes no cut. A payer on another chain sees the route's cost before
                    paying.
                  </span>
                </div>
                <Paper className="flex flex-col gap-1 p-3 sm:p-4">
                  {TEGATA.map((line, i) => (
                    <motion.div
                      key={line}
                      initial={reduce ? false : { opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.12 + i * 0.08, duration: 0.3 }}
                      className="flex items-start gap-3 rounded-[14px] px-3 py-3 text-[16px] leading-snug font-medium"
                    >
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#EEF9DC] text-[#2F7A00]">
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                      {line}
                    </motion.div>
                  ))}
                </Paper>
              </Stage>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ol className="mt-6 flex flex-col gap-1 text-[13px] text-text-3">
        <li id="note-1">
          1.{" "}
          <a
            href="https://stripe.com/pricing"
            className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            Stripe's published pricing
          </a>
          , checked 12 Nov 2026: 2.9% + 30¢, +1.5% for an international card, +1% when the currency
          is converted.
        </li>
        <li id="note-2">
          2.{" "}
          <a
            href="https://wise.com/us/pricing/business/receive"
            className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            Wise Business
          </a>
          , receiving a USD wire: $6.11.
        </li>
      </ol>
    </section>
  )
}
