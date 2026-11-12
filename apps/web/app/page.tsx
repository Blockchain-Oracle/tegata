// The landing page (plan 6.8 F; Privy's split product-stage opening on our lit stage): the promise beside a live
// NEAR Intents calculator, how it works, what NEAR does, who it's for, and a short close.
import { ArrowRight, Check, Link2, Stamp, UsersRound, Wallet } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { BusinessSeal, Lockup, TegataSeal } from "@/components/brand/seal"
import { buttonVariants } from "@/components/kit/button-variants"
import { Paper, Stage } from "@/components/kit/stage"
import { Calculator } from "@/components/landing/calculator"
import { Mark, MarkStack } from "@/components/marks/mark"
import { PAYER_ROUTES } from "@/lib/server/oneclick"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Tegata · Get paid and pay your people in dollars",
  description:
    "Invoices, pay links and payroll for small businesses. Customers pay from any chain; you receive exact dollars on NEAR.",
}

const ROUTES = PAYER_ROUTES.map(({ id, symbol, chain, coin, chainMark }) => ({
  id,
  symbol,
  chain,
  coin,
  chainMark,
}))
const CHAINS = [
  "eth",
  "base",
  "sol",
  "btc",
  "tron",
  "arb",
  "bnb",
  "pol",
  "op",
  "avax",
  "ton",
  "near",
] as const

export default function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Tegata">
            <Lockup size={32} />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {[
              ["How it works", "#how"],
              ["Built on NEAR", "#near"],
              ["Who it's for", "#who"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-[10px] px-3 py-2 text-[15px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/signin"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "max-sm:hidden")}
            >
              Sign in
            </Link>
            <Link href="/signin" className={buttonVariants({ size: "sm" })}>
              Open an account
            </Link>
          </div>
        </div>
      </header>

      {/* Opening: the promise beside the working object. */}
      <section className="mx-auto grid max-w-[1240px] gap-8 px-5 pt-6 pb-16 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:items-stretch lg:gap-10 lg:pt-10">
        <div className="flex flex-col justify-center gap-7 lg:py-10">
          <h1 className="display text-[52px] leading-[0.92] sm:text-[72px] lg:text-[80px]">
            Get paid and pay your people in dollars.
            <span className="block text-text-3">From any chain, on NEAR.</span>
          </h1>
          <p className="max-w-[46ch] text-[18px] text-muted-foreground">
            Invoices, pay links and payroll for small businesses. Your customer pays with the coin
            they hold. You receive exact dollars, with a sealed receipt for every payment.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/signin" className={buttonVariants({ size: "lg" })}>
              Open an account <ArrowRight />
            </Link>
            <Link
              href="/invoice/new"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              Try an invoice, no sign-up
            </Link>
          </div>
          <div className="flex flex-col gap-2.5 pt-2">
            <span className="text-detail font-semibold text-text-3">Customers pay from</span>
            <MarkStack ids={CHAINS} size={34} />
          </div>
        </div>
        <Stage
          className="relative min-h-[560px] p-5 sm:p-10"
          inner="flex items-center justify-center"
        >
          <div className="absolute right-6 bottom-8 hidden rotate-[5deg] xl:block">
            <Paper className="w-[210px] p-4 opacity-95">
              <span className="text-[12px] font-semibold text-[#666]">Receipt · Paid</span>
              <p className="figure mt-1 text-[30px]">$480.00</p>
              <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2F7A00]">
                <Mark id="usdt" chain="tron" size={18} /> From Tron
              </span>
            </Paper>
          </div>
          <div className="relative z-10 w-full max-w-[440px] xl:-translate-x-8">
            <Calculator routes={ROUTES} />
            <div className="absolute -bottom-12 -left-10 hidden sm:block">
              <BusinessSeal name="Paid in dollars" band="Paid" size={110} />
            </div>
          </div>
        </Stage>
      </section>

      {/* How it works: three steps, each with its object. */}
      <section id="how" className="mx-auto max-w-[1240px] scroll-mt-20 px-5 py-16 sm:px-8">
        <h2 className="display max-w-[18ch] text-[44px] leading-[0.95] sm:text-[60px]">
          Three steps. <span className="text-text-3">No crypto words.</span>
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Step
            n="1"
            title="Send a link or an invoice"
            detail="By email, chat or QR. One link takes any coin."
          >
            <Paper className="w-[230px] p-4">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#666]">
                <TegataSeal size={16} textured={false} /> Pay link
              </span>
              <p className="figure mt-1 text-[34px]">$1,250.00</p>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-[10px] bg-[#F5F5F5] px-2.5 py-1.5 text-[12px] font-semibold text-[#666]">
                <Link2 className="size-3.5" /> Link copied
              </span>
            </Paper>
          </Step>
          <Step
            n="2"
            title="They pay from any chain"
            detail="NEAR Intents turns their coin into dollars on the way."
          >
            <div className="flex flex-col items-center gap-3">
              <MarkStack ids={["usdt", "eth", "sol", "btc", "usdc"]} size={40} />
              <ArrowRight className="size-6 rotate-90 text-white" />
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[14px] font-semibold text-black shadow-object">
                <Mark id="usdc" chain="near" size={24} /> $1,250.00 on NEAR
              </span>
            </div>
          </Step>
          <Step
            n="3"
            title="You get exact dollars and a receipt"
            detail="Stamped with your seal, linked to NEAR."
          >
            <div className="relative">
              <Paper className="w-[220px] p-4">
                <span className="text-[12px] font-semibold text-[#666]">Receipt</span>
                <p className="figure mt-1 text-[34px]">$1,250.00</p>
                <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2F7A00]">
                  <Check className="size-3.5" strokeWidth={3} /> Settled on NEAR
                </span>
              </Paper>
              <div className="absolute -top-8 -right-8">
                <BusinessSeal name="Your business" band="Paid" size={84} />
              </div>
            </div>
          </Step>
        </div>
      </section>

      {/* What NEAR does, in plain words. */}
      <section id="near" className="scroll-mt-20 px-3 py-6 sm:px-6">
        <div className="mx-auto max-w-[1300px] rounded-[32px] bg-ai px-5 py-14 text-white sm:px-10 lg:px-14">
          <h2 className="display max-w-[20ch] text-[44px] leading-[0.95] sm:text-[60px]">
            Built on NEAR. <span className="text-white/55">You never touch crypto.</span>
          </h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NearTile
              mark="near"
              title="A name, not an address"
              detail="Every business gets name.tegata.near to be paid at."
            />
            <NearTile
              mark="intents"
              title="Any chain in and out"
              detail="NEAR Intents takes the payer's coin and delivers dollars."
            />
            <NearTile
              mark="usdc"
              title="Real dollars"
              detail="Circle's native USDC on NEAR. Exact amounts in your books."
            />
            <NearTile
              seal
              title="No gas, no wallet"
              detail="Sign in with email. Tegata pays every network fee for you."
            />
          </div>
        </div>
      </section>

      {/* Who it's for: story fields. */}
      <section id="who" className="mx-auto max-w-[1240px] scroll-mt-20 px-5 py-16 sm:px-8">
        <h2 className="display max-w-[18ch] text-[44px] leading-[0.95] sm:text-[60px]">
          Made for small businesses <span className="text-text-3">that work across borders.</span>
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UseCase
            field="bg-sora"
            icon={<Link2 />}
            title="Freelancers"
            detail="Send an invoice. Clients pay with whatever they hold."
          />
          <UseCase
            field="bg-matcha"
            icon={<UsersRound />}
            title="Remote teams"
            detail="Pay everyone in one approval, each where they want it."
          />
          <UseCase
            field="bg-sakura"
            icon={<Wallet />}
            title="Online shops"
            detail="One pay link per product. Paid shows up in seconds."
          />
          <UseCase
            field="bg-kin"
            icon={<Stamp />}
            title="Agencies"
            detail="Sealed receipts and a CSV your accountant understands."
          />
        </div>
      </section>

      {/* Close. */}
      <section className="px-3 pb-6 sm:px-6">
        <Stage
          className="mx-auto max-w-[1300px] px-6 py-20 sm:py-24"
          inner="flex flex-col items-center gap-6 text-center"
          rounded
        >
          <TegataSeal size={84} tone="paper" tilt={-4} />
          <h2 className="display max-w-[16ch] text-[48px] leading-[0.92] sm:text-[72px]">
            Open your account in a minute.
          </h2>
          <Link href="/signin" className={buttonVariants({ variant: "paper", size: "lg" })}>
            Open an account <ArrowRight />
          </Link>
        </Stage>
      </section>

      <footer className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-col gap-2">
          <Lockup size={28} />
          <span className="text-detail text-text-3">手形 (tegata): a written promise to pay.</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            Settled on <Mark id="near" size={18} /> NEAR
          </span>
          <span className="inline-flex items-center gap-1.5">
            Routed by <Mark id="intents" size={18} /> NEAR Intents
          </span>
          <Link href="/signin" className="font-semibold text-foreground hover:underline">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  )
}

function Step({
  n,
  title,
  detail,
  children,
}: {
  n: string
  title: string
  detail: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[24px] bg-card">
      <Stage className="h-[260px]" inner="grid place-items-center" rounded={false} grid={false}>
        {children}
      </Stage>
      <div className="flex gap-4 p-6">
        <span className="figure text-[40px] leading-none text-shu">{n}</span>
        <div className="flex flex-col gap-1">
          <h3 className="text-[19px] font-semibold">{title}</h3>
          <p className="text-[15px] text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  )
}

function NearTile({
  mark,
  seal,
  title,
  detail,
}: {
  mark?: string
  seal?: boolean
  title: string
  detail: string
}) {
  return (
    <div className="flex flex-col gap-5 rounded-[20px] bg-white/8 p-6">
      {seal ? <TegataSeal size={44} /> : <Mark id={mark!} size={44} />}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[19px] font-semibold">{title}</h3>
        <p className="text-[15px] text-white/70">{detail}</p>
      </div>
    </div>
  )
}

function UseCase({
  field,
  icon,
  title,
  detail,
}: {
  field: string
  icon: React.ReactNode
  title: string
  detail: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-56 flex-col justify-between gap-6 rounded-[24px] p-6 text-black",
        field,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-black/10 [&_svg]:size-6">
        {icon}
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="display text-[32px] leading-none">{title}</h3>
        <p className="text-[15px] text-black/70">{detail}</p>
      </div>
    </div>
  )
}
