"use client"

// The README banner (2:1) and the demo cover (16:9), composed from the landing's own parts: the headline with
// "exact" on a block of seal ink, the real marks, and the live 3D seal pressing the bill. Captured at 2× from
// `/dev/banner?bare=1&kind=banner` (1280×640) and `?kind=cover` (960×540), in light and dark
// (.github/diagrams/README.md). Nothing here is shown in the app.
import { Play } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { Lockup, TegataSeal } from "@/components/brand/seal"
import { GRAIN, Stage } from "@/components/kit/stage"
import { Hanko } from "@/components/landing/hanko/hanko"
import { Mark } from "@/components/marks/mark"
import { PAYER_ROUTES } from "@/lib/routes"

/** Six of the eleven routes: at banner size the full ring crowds the seal. */
const PICK = ["usdt-tron", "usdc-base", "btc-btc", "eth-eth", "sol-sol", "usdc-arb"]
const COINS = PAYER_ROUTES.filter((r) => PICK.includes(r.id)).map((r) => ({
  coin: r.coin,
  chain: r.chainMark,
}))

function Desk() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--foreground) 22%, transparent) 1px, transparent 1.2px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(80% 80% at 72% 50%, #000 0%, transparent 80%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[12%] -bottom-[60%] aspect-square w-[900px] rounded-full opacity-50 blur-[90px] dark:opacity-75"
        style={{
          background:
            "radial-gradient(closest-side, #FF4F00 0%, #FF7A2E 38%, color-mix(in oklab, #FFB38A 60%, transparent) 62%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
    </>
  )
}

function Banner() {
  return (
    <div
      id="frame"
      className="landing relative isolate h-[640px] w-[1280px] overflow-hidden bg-background text-foreground"
    >
      <Desk />
      <Hanko
        coins={COINS}
        className="absolute top-[-20px] right-[-40px] bottom-[-230px] left-[540px]"
      />
      <div className="pointer-events-none relative z-10 flex h-full w-[620px] flex-col justify-between px-16 py-14">
        <div className="flex items-center gap-4">
          <Lockup size={40} />
          <span className="rounded-full bg-card px-3 py-1.5 font-mono text-[14px] text-muted-foreground">
            手形 · a written promise to pay
          </span>
        </div>
        <div className="flex flex-col gap-6">
          <h1 className="display text-[92px] leading-[0.9] tracking-[-0.015em]">
            <span className="block">Get paid.</span>
            <span className="block">Pay your team.</span>
            <span className="flex items-baseline gap-x-[0.2em] whitespace-nowrap">
              <span className="text-text-3">In</span>
              <span className="rounded-[0.08em] bg-shu px-[0.08em] text-black">exact</span>
              <span>dollars.</span>
            </span>
          </h1>
          <p className="max-w-[48ch] text-[19px] leading-[1.45] text-pretty text-muted-foreground">
            Invoices, pay links, payroll, cards and bank payouts for small businesses. Paid from any
            chain, settled in USDC on NEAR.
          </p>
        </div>
        <div className="flex items-center gap-6 text-[15px] font-semibold">
          <span className="inline-flex items-center gap-2">
            <Mark id="usdc" chain="near" size={24} /> USDC on NEAR
          </span>
          <span className="inline-flex items-center gap-2">
            <Mark id="intents" size={22} /> NEAR Intents
          </span>
          <span className="inline-flex items-center gap-2">
            <TegataSeal size={22} textured={false} /> Fees paid by Tegata
          </span>
        </div>
      </div>
    </div>
  )
}

function Cover() {
  return (
    <div id="frame" className="landing relative h-[540px] w-[960px] overflow-hidden">
      <Stage tone="lacquer" rounded={false} className="absolute inset-0">
        <Hanko
          coins={COINS}
          night
          className="absolute top-[-10px] right-[-30px] bottom-[-200px] left-[380px]"
        />
        <div className="pointer-events-none relative z-10 flex h-full w-[460px] flex-col justify-between px-14 py-12">
          <Lockup size={36} tone="paper" />
          <div className="flex flex-col gap-5">
            <h1 className="display text-[96px] leading-[0.88] text-white">Try it live.</h1>
            <p className="text-[22px] leading-snug text-white/85">Make an invoice, no sign-up.</p>
            <span className="w-fit rounded-full bg-white/12 px-3.5 py-1.5 font-mono text-[15px] text-white/90">
              tegata.xyz/invoice/new
            </span>
          </div>
          <span className="grid size-20 place-items-center rounded-full bg-white text-shu shadow-[0_18px_40px_-12px_#000a]">
            <Play className="ml-1 size-9 fill-current" />
          </span>
        </div>
      </Stage>
    </div>
  )
}

export default function BannerPage() {
  const kind = useSearchParams().get("kind")
  return kind === "cover" ? <Cover /> : <Banner />
}
