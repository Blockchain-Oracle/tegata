"use client"

// The landing calculator: type what you want to receive, pick the coin your customer holds, and see a
// live NEAR Intents quote for what they send. EXACT_OUTPUT: the business always receives exactly the amount.
import NumberFlow from "@number-flow/react"
import { useQuery } from "@tanstack/react-query"
import { ArrowDown, Clock3 } from "lucide-react"
import { useEffect, useState } from "react"

import { Paper } from "@/components/kit/stage"
import { TextShimmer } from "@/components/kit/states"
import { Mark } from "@/components/marks/mark"
import { ApiError, api } from "@/lib/client/api"
import { fire } from "@/lib/feedback"
import { usd } from "@/lib/fiat"
import { cn } from "@/lib/utils"

export interface CalculatorRoute {
  id: string
  symbol: string
  chain: string
  coin: string
  chainMark: string
}

interface Quote {
  amountInFormatted: string
  amountInUsd: string
  timeEstimate: number
}

const DEBOUNCE_MS = 400
const REFRESH_MS = 30_000
/** The same precision as `coinAmount` (lib/fiat.ts), kept here because the figure rolls digit by digit. */
const DECIMALS: Record<string, number> = { BTC: 6, WBTC: 6, ETH: 5, SOL: 4, BNB: 4, NEAR: 3 }
const TIMING = { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" } as const

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function eta(seconds: number) {
  if (seconds < 90) return `about ${Math.max(10, Math.round(seconds / 10) * 10)} s`
  return `about ${Math.round(seconds / 60)} min`
}

export function Calculator({ routes }: { routes: readonly CalculatorRoute[] }) {
  const [amount, setAmount] = useState("1250")
  const [routeId, setRouteId] = useState(routes[0]!.id)
  const debounced = useDebounced(amount, DEBOUNCE_MS)
  const route = routes.find((r) => r.id === routeId)!
  const value = Number.parseFloat(debounced || "0") || 0

  const quote = useQuery({
    queryKey: ["quote", routeId, debounced],
    queryFn: () =>
      api<Quote>(`/api/quote?amount=${encodeURIComponent(debounced)}&route=${routeId}`),
    enabled: value > 0,
    refetchInterval: REFRESH_MS,
    retry: false,
    placeholderData: (previous) => previous,
  })

  const sends = quote.data ? Number.parseFloat(quote.data.amountInFormatted) : 0

  return (
    <Paper className="w-full max-w-[440px] p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-paper-text-2">You get paid</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-sunk px-2.5 py-1 text-[12px] font-semibold text-paper-text-2">
          <span className="size-1.5 animate-pulse rounded-full bg-[#2F7A00]" /> Live quote
        </span>
      </div>
      <label className="mt-1 flex items-baseline gap-1">
        <span className={cn("figure text-[44px]", value > 0 ? "text-black" : "text-paper-text-3")}>
          $
        </span>
        <input
          aria-label="Amount you receive in dollars"
          inputMode="decimal"
          value={amount}
          onChange={(e) =>
            setAmount(
              e.target.value
                .replace(/[^0-9.]/g, "")
                .replace(/(\..*)\./g, "$1")
                .slice(0, 10),
            )
          }
          className="figure w-full min-w-0 bg-transparent text-[56px] text-black outline-none focus-visible:outline-none"
        />
      </label>

      <p className="mt-3 text-[13px] font-semibold text-paper-text-2">Your customer pays with</p>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {routes.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={r.id === routeId}
            title={`${r.symbol} on ${r.chain}`}
            onClick={() => {
              fire("tick")
              setRouteId(r.id)
            }}
            className={cn(
              "press flex flex-col items-center gap-1 rounded-[12px] px-1 py-2 transition-colors",
              r.id === routeId
                ? "bg-[#FFE9DF] shadow-[0_0_0_2px_var(--shu)]"
                : "bg-paper-sunk hover:bg-paper-rule",
            )}
          >
            <Mark id={r.coin} chain={r.chainMark !== r.coin ? r.chainMark : undefined} size={28} />
            <span className="text-[11px] font-semibold leading-none text-black">{r.symbol}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-[16px] bg-paper-sunk p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[12px] font-semibold text-paper-text-2">
              They send on {route.chain}
            </span>
            {quote.isError ? (
              <span className="text-[14px] font-semibold text-[#C8283F]">
                {quote.error instanceof ApiError ? quote.error.message : "No quote right now"}
              </span>
            ) : quote.data && value > 0 ? (
              <span className="figure flex items-baseline gap-1.5 text-[30px] text-black">
                <NumberFlow
                  value={sends}
                  locales="en-US"
                  format={{
                    minimumFractionDigits: 2,
                    maximumFractionDigits: DECIMALS[route.symbol] ?? 2,
                  }}
                  transformTiming={TIMING}
                  spinTiming={TIMING}
                />
                <span className="text-[20px]">{route.symbol}</span>
              </span>
            ) : (
              <TextShimmer className="text-[15px]">Asking NEAR Intents…</TextShimmer>
            )}
          </span>
          <Mark
            id={route.coin}
            chain={route.chainMark !== route.coin ? route.chainMark : undefined}
            size={36}
          />
        </div>
        <div className="flex items-center gap-2 text-paper-text-3">
          <span className="h-px flex-1 bg-paper-rule" />
          <ArrowDown className="size-4" />
          <span className="h-px flex-1 bg-paper-rule" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[12px] font-semibold text-paper-text-2">You receive exactly</span>
            <span className="figure text-[30px] text-black">{usd(value)}</span>
          </span>
          <Mark id="usdc" chain="near" size={36} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-paper-text-2">
        <span className="inline-flex items-center gap-1.5">
          <Mark id="intents" size={16} /> Quote from NEAR Intents
        </span>
        {quote.data ? (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" /> {eta(quote.data.timeEstimate)}
          </span>
        ) : null}
      </div>
    </Paper>
  )
}
