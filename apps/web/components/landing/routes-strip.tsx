// The routes strip (DESIGN.md "The landing page" §3): every coin-and-chain a client can pay from, in a Magic UI
// marquee, all ending as USDC on NEAR. The list is the app's own (lib/routes.ts), never a longer wish list.
import { Mark } from "@/components/marks/mark"
import { Marquee } from "@/components/ui/marquee"
import { PAYER_ROUTES } from "@/lib/routes"

export function RoutesStrip() {
  return (
    <section aria-label="Coins a client can pay from" className="border-y border-rule">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:gap-8">
        <p className="shrink-0 text-[15px] leading-snug font-semibold lg:w-[220px]">
          Your client pays from
          <span className="mt-0.5 flex items-center gap-1.5 font-medium text-muted-foreground">
            you get <Mark id="usdc" chain="near" size={20} /> USDC on NEAR
          </span>
        </p>
        <Marquee
          pauseOnHover
          repeat={3}
          className="min-w-0 flex-1 [--duration:46s] [--gap:10px] [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
        >
          {PAYER_ROUTES.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-2.5 rounded-full bg-card py-1.5 pr-4 pl-1.5"
            >
              <Mark id={r.coin} chain={r.chainMark} size={32} />
              <span className="text-[15px] font-semibold">{r.symbol}</span>
              <span className="text-[14px] text-muted-foreground">on {r.chain}</span>
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  )
}
