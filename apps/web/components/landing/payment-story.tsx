"use client"

// How a payment moves (DESIGN.md "The landing page" §5): the pinned scroll, one step per screen, each with the
// product part that does it. Every line is what the code does: the memo on each attempt, the USDC event read from
// the final transaction, the receipt numbered and stamped.
import { Check, Copy, Link2 } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { QRCodeSVG } from "qrcode.react"

import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { GRAIN, Paper, Stage } from "@/components/kit/stage"
import { Mark, MarkStack } from "@/components/marks/mark"
import { ReceiptSlip, SlipRow } from "@/components/receipt/receipt-slip"
import { StickyScroll } from "@/components/ui/sticky-scroll-reveal"
import { cn } from "@/lib/utils"

import { RunningHead, SectionTitle } from "./section"

/** A story field: one flat colour with the stage's grain, for a scene that isn't the seal's moment. */
function Field({
  tone,
  children,
  className,
}: {
  tone: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("relative isolate size-full overflow-hidden", tone, className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.25] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
      {children}
    </div>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[440px] overflow-hidden rounded-[24px] sm:h-[520px] lg:h-full lg:rounded-none">
      {children}
    </div>
  )
}

function Float({
  children,
  className,
  delay = 0,
  rotate = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  rotate?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, rotate: rotate - 4 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={
        reduce ? { duration: 0.1 } : { type: "spring", stiffness: 260, damping: 26, delay }
      }
    >
      {children}
    </motion.div>
  )
}

function SendScene() {
  return (
    <Frame>
      <Field tone="bg-sora" className="grid place-items-center">
        <div className="relative w-[min(86%,400px)]">
          <Float rotate={-3}>
            <Paper className="p-6">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-paper-text-2">
                <TegataSeal size={20} textured={false} /> Invoice · INV-0001
              </span>
              <p className="mt-5 text-[12px] font-medium text-paper-text-3">Amount due</p>
              <p className="figure text-[64px] leading-none">$1,250.00</p>
              <p className="mt-2 text-[13px] text-paper-text-2">
                Due 30 Nov · items, tax and a PDF
              </p>
              <div className="mt-5 flex flex-col gap-2 border-t border-paper-rule pt-4 text-[14px]">
                <span className="flex justify-between">
                  <span>Brand and website design</span>
                  <span className="font-semibold">$1,250.00</span>
                </span>
                <span className="flex justify-between text-paper-text-2">
                  <span>Part-payments</span>
                  <span>Allowed</span>
                </span>
              </div>
            </Paper>
          </Float>
          <Float delay={0.25} rotate={4} className="absolute -right-6 -bottom-16 sm:-right-14">
            <Paper className="flex items-center gap-4 p-3 pr-5">
              <div className="rounded-[12px] bg-white p-1.5">
                <QRCodeSVG value="https://tegata.xyz/invoice/new" size={84} fgColor="#16130F" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-paper-text-2">
                  <Link2 className="size-3.5" /> Pay link
                </span>
                <span className="font-mono text-[13px]">tegata.xyz/i/…</span>
                <span className="inline-flex w-fit items-center gap-1 rounded-[8px] bg-paper-sunk px-2 py-1 text-[12px] font-semibold">
                  <Copy className="size-3" /> Copied
                </span>
              </div>
            </Paper>
          </Float>
        </div>
      </Field>
    </Frame>
  )
}

const WAYS = [
  {
    icon: <TegataSeal size={34} textured={false} />,
    title: "Tegata balance",
    detail: "Hold to pay, no fees",
  },
  {
    icon: <Mark id="near" size={34} />,
    title: "Any NEAR wallet",
    detail: "One prompt in their wallet",
  },
  {
    icon: <MarkStack ids={["usdt", "btc", "eth", "sol"]} size={30} />,
    title: "Another chain",
    detail: "A deposit address, through NEAR Intents",
  },
  {
    icon: (
      <span className="flex gap-1">
        <img src="/marks/visa.svg" alt="" className="h-[22px] w-auto rounded-[5px]" />
        <img src="/marks/mastercard.svg" alt="" className="h-[22px] w-auto rounded-[5px]" />
      </span>
    ),
    title: "A card",
    detail: "Through Transak, where it's switched on",
  },
]

function PayScene() {
  return (
    <Frame>
      <Field tone="bg-sakura" className="grid place-items-center">
        <Float className="w-[min(88%,420px)]">
          <Paper className="p-5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[13px] font-semibold text-paper-text-2">Pay your business</span>
              <span className="figure text-[30px]">$1,250.00</span>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {WAYS.map((w, i) => (
                <motion.div
                  key={w.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.09 }}
                  className={cn(
                    "flex items-center gap-3 rounded-[16px] px-3 py-3",
                    i === 2 ? "bg-paper-wash" : "bg-paper-sunk",
                  )}
                >
                  <span className="flex w-[78px] shrink-0 justify-center">{w.icon}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[16px] font-semibold">{w.title}</span>
                    <span className="text-[13px] text-paper-text-2">{w.detail}</span>
                  </span>
                </motion.div>
              ))}
            </div>
          </Paper>
        </Float>
      </Field>
    </Frame>
  )
}

const CHECKS = [
  ["memo", "tegata:pay:<attempt id>"],
  ["receiver", "studio.tegata.near"],
  ["amount", "1,250.000000 USDC"],
  ["status", "final on NEAR"],
] as const

function CheckScene() {
  const reduce = useReducedMotion()
  return (
    <Frame>
      <Field tone="bg-ai" className="grid place-items-center text-white">
        <div className="w-[min(88%,460px)]">
          <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-white/80">
            <Mark id="near" size={22} /> Reading the USDC transfer event
          </div>
          <div className="rounded-[20px] bg-black/35 p-5 font-mono text-[14px] backdrop-blur-sm">
            {CHECKS.map(([k, v], i) => (
              <motion.div
                key={k}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduce ? 0 : 0.2 + i * 0.35 }}
                className="flex items-center justify-between gap-3 border-b border-white/10 py-3 last:border-0"
              >
                <span className="text-white/55">{k}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{v}</span>
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: reduce ? 0 : 0.45 + i * 0.35,
                      type: "spring",
                      stiffness: 500,
                      damping: 22,
                    }}
                    className="grid size-5 shrink-0 place-items-center rounded-full bg-[#B5F543] text-black"
                  >
                    <Check className="size-3" strokeWidth={3.5} />
                  </motion.span>
                </span>
              </motion.div>
            ))}
          </div>
          <p className="mt-4 text-[14px] text-white/70">
            Nothing the payer's browser says is believed. If one line doesn't match, it isn't paid.
          </p>
        </div>
      </Field>
    </Frame>
  )
}

function SealScene() {
  return (
    <Frame>
      <Stage className="size-full" rounded={false} inner="grid place-items-center">
        <Float className="w-[min(86%,380px)]">
          <ReceiptSlip
            label="Receipt · No. 0001"
            amount={1250}
            sub={
              <>
                <Mark id="usdc" chain="near" size={18} /> USDC on NEAR
              </>
            }
            seal={
              <SealPress delay={0.45}>
                <BusinessSeal name="Your business" band="Paid" size={92} />
              </SealPress>
            }
          >
            <SlipRow label="For">INV-0001</SlipRow>
            <SlipRow label="Paid with">USDT on Tron</SlipRow>
            <SlipRow label="Transaction">On NEAR ↗</SlipRow>
          </ReceiptSlip>
        </Float>
      </Stage>
    </Frame>
  )
}

const STEPS = [
  {
    title: "Send an invoice or a pay link.",
    description:
      "Numbered invoices with items, tax and due dates, part-payments and repeats. Or a link and a QR for a fixed or open amount. Customers open it on any phone.",
    content: <SendScene />,
  },
  {
    title: "They pay the way they can.",
    description:
      "From a Tegata balance, any NEAR wallet, a coin on another chain through NEAR Intents, or a card where card payments are on. You always receive the exact amount.",
    content: <PayScene />,
  },
  {
    title: "NEAR decides when it's paid.",
    description:
      "Every attempt carries its own memo. Tegata waits for the final transaction, reads the USDC contract's own transfer event, and checks the receiver, the amount and the memo.",
    content: <CheckScene />,
  },
  {
    title: "Your seal stamps the receipt.",
    description:
      "Your business's own seal presses a numbered receipt that links to the transaction. Both of you get it by email, and it lands in your books.",
    content: <SealScene />,
  },
]

export function PaymentStory() {
  return (
    <section id="how" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 pt-20 sm:px-8 lg:pt-28">
      <RunningHead n="02" label="How a payment moves" />
      <SectionTitle className="mt-8 max-w-[16ch]">
        Four steps. <span className="text-text-3">You only do the first.</span>
      </SectionTitle>
      <StickyScroll content={STEPS} className="mt-6" />
    </section>
  )
}
