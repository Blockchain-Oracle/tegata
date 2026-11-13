// The landing page (DESIGN.md "The landing page"): the story of one bill, from the promise to the proof on NEAR,
// on washi in light and sumi in dark, with one real 3D object. Every figure is real or sourced.
import type { Metadata } from "next"

import { BeforeAfter } from "@/components/landing/before-after"
import { Borders } from "@/components/landing/borders"
import { BuiltOnNear } from "@/components/landing/built-on-near"
import { Close, Footer, Questions } from "@/components/landing/closing"
import { Features } from "@/components/landing/features"
import { Hero } from "@/components/landing/hero"
import { LiveQuote } from "@/components/landing/live-quote"
import { LandingNav } from "@/components/landing/nav"
import { PaymentStory } from "@/components/landing/payment-story"
import { Payroll } from "@/components/landing/payroll"
import { Proof } from "@/components/landing/proof"
import { RoutesStrip } from "@/components/landing/routes-strip"

export const metadata: Metadata = {
  title: { absolute: "Tegata · Get paid. Pay your team. In exact dollars." },
  description:
    "The money account for a small business: invoices, pay links and payroll, paid from any coin on any chain and settled in USDC on NEAR. Sign in with email; Tegata pays every network fee and seals every receipt.",
}

export default function Landing() {
  return (
    <div className="landing min-h-dvh overflow-x-clip bg-background text-foreground">
      <LandingNav />
      <main>
        <Hero />
        <RoutesStrip />
        <BeforeAfter />
        <PaymentStory />
        <LiveQuote />
        <Payroll />
        <Borders />
        <Features />
        <Proof />
        <BuiltOnNear />
        <Questions />
        <Close />
      </main>
      <Footer />
    </div>
  )
}
