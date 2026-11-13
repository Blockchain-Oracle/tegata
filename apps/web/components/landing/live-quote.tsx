// A real quote (DESIGN.md "The landing page" §6): the landing calculator on the lit stage, asking NEAR Intents for a
// dry EXACT_OUTPUT quote, with every route in orbit around it (Magic UI orbiting circles).
import { Stage } from "@/components/kit/stage"
import { Calculator } from "@/components/landing/calculator"
import { Mark } from "@/components/marks/mark"
import { OrbitingCircles } from "@/components/ui/orbiting-circles"
import { PAYER_ROUTES } from "@/lib/routes"

import { Rise, RunningHead, SectionTitle } from "./section"

const ROUTES = PAYER_ROUTES.map(({ id, symbol, chain, coin, chainMark }) => ({
  id,
  symbol,
  chain,
  coin,
  chainMark,
}))
const INNER = PAYER_ROUTES.slice(0, 5)
const OUTER = PAYER_ROUTES.slice(5)

export function LiveQuote() {
  return (
    <section id="quote" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 pt-24 sm:px-8 lg:pt-32">
      <RunningHead n="03" label="A real quote" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <SectionTitle className="max-w-[12ch]">
            Price it live. <span className="text-text-3">Get it exact.</span>
          </SectionTitle>
          <Rise className="flex max-w-[44ch] flex-col gap-4 text-[18px] leading-[1.5] text-muted-foreground">
            <p>
              Type what you want to receive. Pick the coin your client holds. NEAR Intents quotes
              what they send, so that exactly that many dollars reach you.
            </p>
            <p className="flex items-center gap-2 text-[15px]">
              <Mark id="intents" size={22} />
              Live dry quotes from the 1Click API, refreshed every 30 seconds.
            </p>
          </Rise>
        </div>
        <Stage
          className="relative min-h-[620px] rounded-[32px] p-5 sm:min-h-[700px] sm:p-10"
          inner="grid place-items-center"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
            <div className="relative size-full">
              <div className="absolute inset-0 flex items-center justify-center">
                <OrbitingCircles
                  radius={262}
                  iconSize={44}
                  duration={60}
                  path
                  pathClassName="stroke-white/30"
                >
                  {INNER.map((r) => (
                    <Mark key={r.id} id={r.coin} chain={r.chainMark} size={44} />
                  ))}
                </OrbitingCircles>
                <OrbitingCircles
                  radius={330}
                  iconSize={40}
                  duration={80}
                  reverse
                  path
                  pathClassName="stroke-white/20"
                >
                  {OUTER.map((r) => (
                    <Mark key={r.id} id={r.coin} chain={r.chainMark} size={40} />
                  ))}
                </OrbitingCircles>
              </div>
            </div>
          </div>
          <div className="relative z-10 w-full max-w-[440px]">
            <Calculator routes={ROUTES} />
          </div>
        </Stage>
      </div>
    </section>
  )
}
