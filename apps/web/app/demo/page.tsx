// /demo: the film, played here, and what stands behind it. The video first with its chapters, then five moments from
// it (each a still from the film and a way into the product), then the NEAR transactions made on camera and the
// landing's ledger of earlier proofs, each opening on the explorer.
import { ArrowRight, ArrowUpRight, Play } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { DemoPlayer } from "@/components/demo/player"
import { buttonVariants } from "@/components/kit/button-variants"
import { Close, Footer } from "@/components/landing/closing"
import { LandingNav } from "@/components/landing/nav"
import { LEDGER, TX } from "@/components/landing/proof"
import { Rise, RunningHead, SectionTitle } from "@/components/landing/section"
import { Mark } from "@/components/marks/mark"
import { DEMO_LENGTH, FILM_LEDGER, MOMENTS } from "@/lib/demo"
import { cn } from "@/lib/utils"

const DESCRIPTION =
  "Watch Tegata work in two minutes: an invoice paid and sealed, payroll in one hold, team approvals, autopilot, the bank and the books. Then open the NEAR transactions the film made."

export const metadata: Metadata = {
  title: "Demo",
  description: DESCRIPTION,
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "Tegata · the demo",
    description: DESCRIPTION,
    url: "/demo",
    type: "website",
  },
}

function LedgerRow({ what, tx, delay }: { what: string; tx: string; delay: number }) {
  return (
    <Rise delay={delay}>
      <a
        href={`${TX}${tx}`}
        target="_blank"
        rel="noreferrer"
        className="group grid gap-2 border-t border-rule py-4 transition-colors hover:bg-card sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:px-3"
      >
        <span className="text-[16px] leading-snug">{what}</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[14px] text-shu-ink">
          {tx.slice(0, 6)}…
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </a>
    </Rise>
  )
}

export default function Demo() {
  return (
    <div className="landing min-h-dvh overflow-x-clip bg-background text-foreground">
      <LandingNav />
      <main>
        <section className="mx-auto max-w-[1240px] px-5 pt-24 sm:px-8 lg:pt-32">
          <RunningHead n="00" label="The demo" />
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-12">
            <h1 className="display text-[clamp(64px,10.5vw,148px)] leading-[0.88] tracking-[-0.012em]">
              See Tegata{" "}
              <span className="inline-block rounded-[0.12em] bg-shu px-[0.1em] pb-[0.03em] text-black">
                work.
              </span>
            </h1>
            <div className="flex flex-col gap-5 lg:pb-3">
              <p className="max-w-[46ch] text-[18px] leading-[1.5] text-muted-foreground sm:text-[19px]">
                The whole product in {DEMO_LENGTH}, recorded from the app. Then the payments it made
                on NEAR, each one a link you can open.
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
            </div>
          </div>
          <div id="film" className="mt-10 scroll-mt-24 lg:mt-14">
            <Suspense
              fallback={<div className="aspect-video w-full rounded-[32px] bg-[#120d0a]" />}
            >
              <DemoPlayer />
            </Suspense>
          </div>
        </section>

        <section
          id="moments"
          className="mx-auto max-w-[1240px] scroll-mt-24 px-5 pt-24 sm:px-8 lg:pt-32"
        >
          <RunningHead n="01" label="What is in it" />
          <SectionTitle className="mt-8 max-w-[14ch]">Five moments, all real.</SectionTitle>
          <div className="mt-12 flex flex-col gap-16 lg:mt-16 lg:gap-24">
            {MOMENTS.map((moment, i) => (
              <article
                key={moment.n}
                className={cn(
                  "grid items-center gap-7 lg:gap-14",
                  i % 2 === 1 ? "lg:grid-cols-[1.18fr_0.82fr]" : "lg:grid-cols-[0.82fr_1.18fr]",
                )}
              >
                <Rise className={cn("flex flex-col gap-4", i % 2 === 1 && "lg:order-2")}>
                  <span className="font-mono text-[13px] text-text-3">
                    {moment.n} · {moment.label}
                  </span>
                  <h3 className="display text-[clamp(36px,4.4vw,60px)] leading-[0.94]">
                    {moment.title}
                  </h3>
                  <p className="max-w-[46ch] text-[17px] leading-[1.55] text-muted-foreground">
                    {moment.body}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[15px] font-semibold">
                    <Link
                      href={`/demo?t=${moment.at}#film`}
                      className="inline-flex items-center gap-2 rounded-full bg-secondary py-2 pr-4 pl-3 transition-colors hover:bg-accent"
                    >
                      <Play className="size-3.5 fill-current" /> Watch this part
                    </Link>
                    <Link
                      href={moment.link.href}
                      className="inline-flex items-center gap-1 text-shu-ink hover:underline"
                    >
                      {moment.link.text} <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </Rise>
                <Rise delay={0.06} className={cn(i % 2 === 1 && "lg:order-1")}>
                  <Link
                    href={`/demo?t=${moment.at}#film`}
                    aria-label={`Watch this part: ${moment.label}`}
                    className="group relative block overflow-hidden rounded-[22px] bg-card shadow-object sm:rounded-[28px]"
                  >
                    <img
                      src={moment.image}
                      alt={moment.alt}
                      width={1600}
                      height={900}
                      loading="lazy"
                      className="block w-full"
                    />
                    <span className="absolute right-4 bottom-4 grid size-12 place-items-center rounded-full bg-foreground text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Play className="size-5 fill-current" />
                    </span>
                  </Link>
                </Rise>
              </article>
            ))}
          </div>
        </section>

        <section
          id="verify"
          className="mx-auto max-w-[1240px] scroll-mt-24 px-5 pt-24 sm:px-8 lg:pt-32"
        >
          <RunningHead n="02" label="Check it on NEAR" />
          <SectionTitle className="mt-8 max-w-[16ch]">
            Don't trust the film. Open the receipts.
          </SectionTitle>
          <div className="mt-10 flex flex-col">
            <div className="mb-3 flex items-center justify-between text-[13px] font-semibold text-text-3">
              <span className="inline-flex items-center gap-2">
                <Mark id="near" size={18} /> Made on camera, on NEAR testnet
              </span>
              <span className="hidden sm:inline">Transaction</span>
            </div>
            {FILM_LEDGER.map((row, i) => (
              <LedgerRow key={row.tx} what={row.what} tx={row.tx} delay={i * 0.03} />
            ))}
            <div className="mt-12 mb-3 flex items-center justify-between text-[13px] font-semibold text-text-3">
              <span className="inline-flex items-center gap-2">
                <Mark id="near" size={18} /> Behind the rest of what it says
              </span>
              <span className="hidden sm:inline">Transaction</span>
            </div>
            {LEDGER.map((row, i) => (
              <LedgerRow key={row.tx} what={row.what} tx={row.tx} delay={i * 0.03} />
            ))}
            <p className="border-t border-rule pt-4 text-[14px] text-muted-foreground">
              The film runs on the Sandbox: NEAR testnet and test dollars. The $1,250 invoice in its
              opening is an example, and says so. Live, on NEAR mainnet, is switched on as{" "}
              <span className="font-mono">tegata.near</span>; every proof here is on testnet so far.
            </p>
          </div>
        </section>

        <Close />
      </main>
      <Footer />
    </div>
  )
}
