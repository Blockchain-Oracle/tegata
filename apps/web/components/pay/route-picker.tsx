"use client"

// Coin first, then chain: USDC · USDT · ETH · BTC · SOL as chips with their real marks, then the chains that coin can
// arrive on (or be paid from) as tiles. Switching coin keeps the chain when the new coin has it. One picker for the
// pay page, Send to another chain and where a person's pay lands, so the routes read the same everywhere.
import { Check } from "lucide-react"

import { Mark } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

export interface PickableRoute {
  id: string
  symbol: string
  chain: string
  coin: string
  chainMark: string
}

/** USDT0 is Tether's own USDT on Arbitrum: it sits with USDT, its tile says which. */
const coinOf = (route: PickableRoute) => (route.symbol === "USDT0" ? "USDT" : route.symbol)

export function RoutePicker({
  routes,
  value,
  onChange,
  tone = "plate",
}: {
  routes: readonly PickableRoute[]
  value: string
  onChange: (id: string) => void
  /** "plate" on a card (tiles on the sunk plate), "card" on the page. */
  tone?: "plate" | "card"
}) {
  const groups: { symbol: string; coin: string; routes: PickableRoute[] }[] = []
  for (const route of routes) {
    const symbol = coinOf(route)
    const group = groups.find((g) => g.symbol === symbol)
    if (group) group.routes.push(route)
    else groups.push({ symbol, coin: route.coin, routes: [route] })
  }
  const selected = routes.find((r) => r.id === value) ?? routes[0]
  const current = groups.find((g) => g.symbol === (selected ? coinOf(selected) : "")) ?? groups[0]
  if (!current || !selected) return null

  const pickCoin = (symbol: string) => {
    const group = groups.find((g) => g.symbol === symbol)
    if (!group || group === current) return
    fire("tick")
    const same = group.routes.find((r) => r.chainMark === selected.chainMark)
    onChange((same ?? group.routes[0] ?? selected).id)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Coin">
        {groups.map((g) => {
          const on = g === current
          return (
            <button
              key={g.symbol}
              type="button"
              aria-pressed={on}
              onClick={() => pickCoin(g.symbol)}
              className={cn(
                "press inline-flex h-11 items-center gap-2 rounded-full pr-3.5 pl-1.5 text-[15px] font-semibold",
                on
                  ? "bg-foreground text-background"
                  : tone === "plate"
                    ? "bg-secondary hover:bg-plate-pressed"
                    : "bg-card shadow-[0_0_0_1px_var(--border)] hover:bg-secondary",
              )}
            >
              <Mark id={g.coin} size={30} />
              {g.symbol}
              {g.routes.length > 1 ? (
                <span className={cn("text-[13px] font-medium", on ? "opacity-70" : "text-text-3")}>
                  {g.routes.length}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        role="radiogroup"
        aria-label={`Chain for ${current.symbol}`}
      >
        {current.routes.map((r) => {
          const on = r.id === selected.id
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (on) return
                fire("tick")
                onChange(r.id)
              }}
              className={cn(
                "press relative flex flex-col items-center gap-1.5 rounded-[14px] px-2 py-3 text-center",
                tone === "plate" ? "bg-secondary" : "bg-card shadow-[0_0_0_1px_var(--border)]",
                on && "bg-card shadow-[0_0_0_2px_var(--shu)]",
              )}
            >
              <Mark id={r.coin} chain={r.chainMark} size={30} />
              <span className="text-[13px] leading-tight font-semibold">{r.chain}</span>
              {r.symbol !== current.symbol ? (
                <span className="text-[12px] leading-tight text-muted-foreground">{r.symbol}</span>
              ) : null}
              {on ? (
                <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-shu text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
