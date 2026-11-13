"use client"

// The opening (DESIGN.md "The landing page" §2): the promise cut in line by line (after Fancy's vertical cut reveal) on
// the left, the 3D hanko pressing a bill on the right, on washi with one vermilion light rising behind the desk.
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/kit/button-variants"
import { GRAIN } from "@/components/kit/stage"
import { fire } from "@/lib/feedback"
import { PAYER_ROUTES, ROUTE_COUNT } from "@/lib/routes"
import { cn } from "@/lib/utils"

import { Hanko } from "./hanko/hanko"

const COINS = PAYER_ROUTES.map((r) => ({ coin: r.coin, chain: r.chainMark }))

/**
 * The headline cut in character by character, after Fancy Components' vertical cut reveal, but in CSS keyframes:
 * it plays the moment the stylesheet loads and never waits on hydration or a busy main thread (three.js warming
 * up), so the promise is never blank. Reduced motion: the global rule lands it at once.
 */
function Cut({
  children,
  delay,
  className,
}: {
  children: string
  delay: number
  className?: string
}) {
  let i = 0
  return (
    <span className={cn("inline-flex flex-wrap", className)}>
      <span className="sr-only">{children}</span>
      {children.split(" ").map((word, w, words) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed headline; its words have no identity but their place.
          key={`${word}-${w}`}
          aria-hidden
          className="-mx-[0.06em] inline-flex overflow-hidden px-[0.06em]"
        >
          {Array.from(word).map((ch) => {
            const d = delay + i++ * 0.018
            return (
              <span
                key={`${ch}-${d}`}
                className="inline-block animate-[cut-in_640ms_cubic-bezier(0.2,0.9,0.25,1.12)_both]"
                style={{ animationDelay: `${d}s` }}
              >
                {ch}
              </span>
            )
          })}
          {w < words.length - 1 ? <span>&nbsp;</span> : null}
        </span>
      ))}
    </span>
  )
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-24 lg:min-h-[min(100svh,920px)] lg:pt-32">
      {/* The desk: a faint dot grid, and the vermilion light rising behind the seal. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 dark:opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--foreground) 22%, transparent) 1px, transparent 1.2px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(80% 70% at 70% 45%, #000 0%, transparent 78%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[18%] -bottom-[38%] -z-10 aspect-square w-[min(1100px,120vw)] rounded-full opacity-45 blur-[90px] dark:opacity-70"
        style={{
          background:
            "radial-gradient(closest-side, #FF4F00 0%, #FF7A2E 38%, color-mix(in oklab, #FFB38A 60%, transparent) 62%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />

      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
        <div className="pointer-events-none relative z-10 flex flex-col gap-7 pt-6 lg:max-w-[600px] lg:pt-4 lg:pb-24 [&_a]:pointer-events-auto [&_dl]:pointer-events-auto">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1.5 font-mono text-[13px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-shu" />
            手形 · a written promise to pay
          </span>
          {/* 14.5vw: "In exact dollars." (one line, 5.77em wide) fits a 320px phone with room to spare. */}
          <h1 className="display text-[clamp(40px,14.5vw,94px)] leading-[0.9] tracking-[-0.015em] lg:text-[clamp(64px,6.6vw,94px)]">
            <span className="block overflow-hidden pb-[0.06em]">
              <Cut delay={0.05}>Get paid.</Cut>
            </span>
            <span className="block overflow-hidden pb-[0.06em]">
              <Cut delay={0.25}>Pay your team.</Cut>
            </span>
            <span className="flex items-baseline gap-x-[0.2em] overflow-hidden pb-[0.06em] whitespace-nowrap">
              <Cut delay={0.45} className="text-text-3">
                In
              </Cut>
              <span className="relative inline-block px-[0.08em]">
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-[0.1em] bottom-[0.02em] -z-10 origin-left animate-[ink-in_700ms_var(--ease-roll)_900ms_both] rounded-[0.08em] bg-shu"
                />
                <Cut delay={0.55} className="text-black">
                  exact
                </Cut>
              </span>
              <Cut delay={0.65}>dollars.</Cut>
            </span>
          </h1>
          <p className="max-w-[48ch] text-[18px] leading-[1.5] text-muted-foreground sm:text-[19px]">
            The money account for a small business. Send an invoice or a pay link, get paid from
            whatever coin your client holds, and pay your whole team with one approval. Settled in
            USDC on NEAR, with a sealed receipt for every payment.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/signin"
              onClick={() => fire("press", { cue: "tap" })}
              className={buttonVariants({ size: "lg" })}
            >
              Open an account <ArrowRight />
            </Link>
            <Link
              href="/invoice/new"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              Try an invoice, no sign-up
            </Link>
          </div>
          <dl className="grid max-w-[520px] grid-cols-3 gap-3 pt-2">
            {[
              ["0", "NEAR to hold. Sign in with email."],
              [String(ROUTE_COUNT), "coins and chains a client can pay from"],
              ["1", "approval pays your whole team"],
            ].map(([n, label]) => (
              <div key={label} className="flex flex-col gap-1 border-t border-rule pt-3">
                <dt className="figure text-[34px]">{n}</dt>
                <dd className="text-[13px] leading-[1.35] text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <Hanko
        coins={COINS}
        className={cn(
          "h-[480px] sm:h-[600px] lg:absolute lg:inset-y-0 lg:right-0 lg:left-[38%] lg:h-auto",
        )}
      />
    </section>
  )
}
