"use client"

// Questions, the close and the footer (DESIGN.md "The landing page" §12–13). The answers say what is true today,
// custody and Sandbox included. The footer sets 手形 large, from the seal's own outlines.
import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Lockup, TegataSeal } from "@/components/brand/seal"
import { buttonVariants } from "@/components/kit/button-variants"
import { Stage } from "@/components/kit/stage"
import { Mark } from "@/components/marks/mark"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { SEAL_FACES } from "@/lib/brand/glyphs"
import { fire } from "@/lib/feedback"
import { LINKS } from "@/lib/links"
import { cn } from "@/lib/utils"

import { Rise, RunningHead, SectionTitle } from "./section"

const QUESTIONS = [
  {
    q: "Do I need a wallet, or any NEAR?",
    a: "No. You sign in with your email and Tegata opens a NEAR account named after your business, with your own key from that login. Tegata relays every action and pays its network fee, so your account holds 0 NEAR. If you already have a NEAR wallet, you can sign in with it instead.",
  },
  {
    q: "What do my customers need?",
    a: "Whatever they already hold. They can pay from a Tegata balance, any NEAR wallet, or in Live a coin on another chain (USDT on Tron, USDC on Base, BTC, ETH, SOL and more) through NEAR Intents. Card payments open where they are switched on.",
  },
  {
    q: "What does it cost?",
    a: "Tegata takes no cut of your payments and pays the network fees. A customer paying from another chain sees that route's cost before they pay, and you still receive exactly what you billed.",
  },
  {
    q: "Who holds the money?",
    a: "Your business's own NEAR account does: name.tegata.near in Live, name.tegata.testnet in the Sandbox. Money on its way to a card or a bank passes through Tegata's operator account for minutes; everywhere else it moves from your account.",
  },
  {
    q: "Is it live?",
    a: "Two modes, one switch apart. The Sandbox is the whole app on NEAR testnet with free test dollars. Live is the same app on NEAR mainnet with real dollars, switched on as tegata.near; every recorded proof so far is on testnet.",
  },
  {
    q: "What does my accountant get?",
    a: "Numbered invoices and receipts, every movement in Activity with who, what, when and how, a CSV and a statement PDF each month, and your books checked against NEAR, transfer by transfer.",
  },
]

export function Questions() {
  return (
    <section id="faq" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 pt-24 sm:px-8 lg:pt-32">
      <RunningHead n="09" label="Questions" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionTitle className="max-w-[10ch]">
          Fair <span className="text-text-3">questions.</span>
        </SectionTitle>
        <Rise>
          <Accordion type="single" collapsible defaultValue="q0" className="flex flex-col">
            {QUESTIONS.map((item, i) => (
              <AccordionItem key={item.q} value={`q${i}`} className="border-rule">
                <AccordionTrigger
                  onClick={() => fire("tick")}
                  className="py-5 text-[19px] font-semibold hover:no-underline [&>svg]:size-5"
                >
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="max-w-[62ch] pb-6 text-[16px] leading-[1.6] text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Rise>
      </div>
    </section>
  )
}

export function Close() {
  return (
    <section className="px-3 pt-24 sm:px-6 lg:pt-32">
      <Stage
        className="mx-auto max-w-[1300px] rounded-[32px] px-6 py-20 sm:py-28"
        inner="flex flex-col items-center gap-7 text-center"
      >
        <TegataSeal size={92} tone="paper" tilt={-4} />
        <h2 className="display max-w-[14ch] text-[clamp(52px,8vw,108px)] leading-[0.9]">
          Open your account in a minute.
        </h2>
        <p className="max-w-[44ch] text-[18px] text-white/90">
          Email, a business name and a pay address. Your NEAR account opens while you watch.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/signin"
            onClick={() => fire("press", { cue: "tap" })}
            className={buttonVariants({ variant: "paper", size: "lg" })}
          >
            Open an account <ArrowRight />
          </Link>
          <Link
            href="/invoice/new"
            className={cn(
              buttonVariants({ variant: "veil", size: "lg" }),
              "bg-black/20 hover:bg-black/30",
            )}
          >
            Try an invoice, no sign-up
          </Link>
        </div>
      </Stage>
    </section>
  )
}

/** 手形, set from the seal's real outlines, as large as the page allows. */
function Kanji({ className }: { className?: string }) {
  const g = SEAL_FACES.shippori.glyphs
  return (
    <svg viewBox="0 0 2000 1000" className={className} aria-hidden="true">
      <path d={g.手.d} transform="translate(0 -290)" fill="currentColor" />
      <path d={g.形.d} transform="translate(1000 -290)" fill="currentColor" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-[1240px] px-5 pt-24 pb-10 sm:px-8">
      <div className="grid gap-10 border-t border-rule pt-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Lockup size={32} />
          <p className="max-w-[34ch] text-[14px] text-muted-foreground">
            手形 (tegata) is the old Japanese bill of exchange: a written promise to pay, sealed by
            whoever issues it.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-[15px]">
          <span className="text-[13px] font-semibold text-text-3">Product</span>
          <a href="#how" className="hover:underline">
            How it works
          </a>
          <a href="#payroll" className="hover:underline">
            Payroll
          </a>
          <a href="#borders" className="hover:underline">
            Across borders
          </a>
          <a href="#features" className="hover:underline">
            Everything else
          </a>
        </div>
        <div className="flex flex-col gap-2 text-[15px]">
          <span className="text-[13px] font-semibold text-text-3">Learn</span>
          <a href={LINKS.docs} className="hover:underline">
            Docs
          </a>
          <a href={`${LINKS.docs}/docs/how-money-moves`} className="hover:underline">
            How money moves
          </a>
          <a href={`${LINKS.docs}/docs/build/developers`} className="hover:underline">
            API and webhooks
          </a>
          <a href="#proof" className="hover:underline">
            Proof on NEAR
          </a>
        </div>
        <div className="flex flex-col gap-2 text-[15px]">
          <span className="text-[13px] font-semibold text-text-3">Start</span>
          <Link href="/signin" className="hover:underline">
            Open an account
          </Link>
          <Link href="/signin" className="hover:underline">
            Sign in
          </Link>
          <Link href="/invoice/new" className="hover:underline">
            Try an invoice
          </Link>
        </div>
      </div>
      <Kanji className="mt-14 w-full text-foreground/[0.07]" />
      <div className="mt-6 flex flex-col gap-3 text-[13px] text-text-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            Settled on <Mark id="near" size={16} /> NEAR
          </span>
          <span className="inline-flex items-center gap-1.5">
            Priced by <Mark id="intents" size={16} /> NEAR Intents
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Mark id="usdc" size={16} /> Circle USDC
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href="/download" className="hover:underline">
            Get the app
          </Link>
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <span>Built for NEAR HACKATHON · Real-World Money · MIT licence</span>
        </span>
      </div>
    </footer>
  )
}
