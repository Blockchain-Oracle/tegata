"use client"

// Across borders (DESIGN.md "The landing page" §8): a cobe globe (Magic UI globe) lit on the four places Tegata's
// bank partner reaches today, with each currency in its own sign and round flag, and the Sandbox said plainly.
import type { COBEOptions } from "cobe"
import { ArrowUpRight } from "lucide-react"
import { useMemo } from "react"

import { Mark } from "@/components/marks/mark"
import { Globe } from "@/components/ui/globe"
import { useTheme } from "@/lib/theme"

import { Rise, RunningHead, SectionTitle } from "./section"

const PLACES = [
  {
    flag: "ng",
    sign: "₦",
    name: "Naira",
    where: "Nigeria",
    loc: [6.5244, 3.3792] as [number, number],
  },
  {
    flag: "gh",
    sign: "GH₵",
    name: "Cedi",
    where: "Ghana",
    loc: [5.6037, -0.187] as [number, number],
  },
  {
    flag: "za",
    sign: "R",
    name: "Rand",
    where: "South Africa",
    loc: [-26.2041, 28.0473] as [number, number],
  },
  {
    flag: "eu",
    sign: "€",
    name: "Euro account",
    where: "Deposits arrive as USDC",
    loc: [50.1109, 8.6821] as [number, number],
  },
]

function useGlobeConfig(dark: boolean): COBEOptions {
  return useMemo(
    () => ({
      width: 800,
      height: 800,
      onRender: () => {},
      devicePixelRatio: 2,
      phi: 4.6,
      theta: 0.18,
      dark: dark ? 1 : 0,
      diffuse: dark ? 1.5 : 1.1,
      mapSamples: 20000,
      mapBrightness: dark ? 6 : 2.4,
      baseColor: dark ? [0.34, 0.29, 0.25] : [0.86, 0.82, 0.76],
      markerColor: [1, 79 / 255, 0],
      glowColor: dark ? [0.5, 0.18, 0.05] : [1, 0.86, 0.74],
      markers: PLACES.map((p) => ({ location: p.loc, size: 0.1 })),
    }),
    [dark],
  )
}

export function Borders() {
  const { resolvedTheme } = useTheme()
  const config = useGlobeConfig(resolvedTheme === "dark")
  return (
    <section
      id="borders"
      className="relative mx-auto max-w-[1240px] scroll-mt-24 px-5 pt-24 sm:px-8 lg:pt-32"
    >
      <RunningHead n="05" label="Across borders" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="flex flex-col gap-7">
          <SectionTitle className="max-w-[13ch]">
            Out to a bank. <span className="text-text-3">Across borders.</span>
          </SectionTitle>
          <Rise className="max-w-[46ch] text-[18px] leading-[1.5] text-muted-foreground">
            Withdraw dollars as naira, cedi or rand at a live rate, to a bank you pick by its logo;
            in Nigeria the bank names the account holder as you type. Or take euro bank details
            whose deposits arrive in your balance as USDC.
          </Rise>
          <Rise className="grid gap-2 sm:grid-cols-2">
            {PLACES.map((p) => (
              <div key={p.flag} className="flex items-center gap-3 rounded-[18px] bg-card p-3">
                <img src={`/flags/${p.flag}.svg`} alt="" className="size-10 rounded-full" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[16px] font-semibold">
                    <span className="figure mr-1.5 text-[20px]">{p.sign}</span>
                    {p.name}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">{p.where}</span>
                </span>
              </div>
            ))}
          </Rise>
          <Rise className="flex flex-col gap-3 text-[14px] text-muted-foreground">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-dashed border-rule px-3 py-1.5 font-semibold">
              Sandbox · through Noah, a licensed partner reached from NEAR
            </span>
            <span>
              Bank details work end to end (a simulated €2.00 transfer arrived as 1.16 USDC). A
              withdrawal reaches Noah's last step and waits there until Noah switches payouts on.
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Mark id="intents" size={18} /> Or send dollars to anyone, on NEAR or another chain,
              in the coin they want.
              <a
                href="#proof"
                className="inline-flex items-center gap-0.5 font-semibold text-shu-ink hover:underline"
              >
                See the proof <ArrowUpRight className="size-3.5" />
              </a>
            </span>
          </Rise>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[600px]">
          <Globe key={resolvedTheme} config={config} className="max-w-none" />
        </div>
      </div>
    </section>
  )
}
