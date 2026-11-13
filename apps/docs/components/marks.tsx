import type { CSSProperties } from "react"

/*
 * Real logos in their own colours (the app's marks, apps/web/public/marks: from the NEAR Intents swap widget, MIT,
 * and the brands' own kits). An endless row with faded edges on one CSS keyframe, so the docs ship no animation
 * library; hover pauses it.
 */

export const BUILT_ON = [
  { id: "near", name: "NEAR" },
  { id: "intents", name: "NEAR Intents" },
  { id: "usdc", name: "USDC" },
  { id: "circle", name: "Circle" },
] as const

/** The chains NEAR Intents routes in and out of (apps/web/lib/routes.ts PAYER_ROUTES), and no others. */
export const PRICED = [
  { id: "eth", name: "Ethereum" },
  { id: "base", name: "Base" },
  { id: "sol", name: "Solana" },
  { id: "btc", name: "Bitcoin" },
  { id: "tron", name: "Tron" },
  { id: "arb", name: "Arbitrum" },
  { id: "bnb", name: "BNB Chain" },
  { id: "pol", name: "Polygon" },
  { id: "gnosis", name: "Gnosis" },
  { id: "usdt", name: "USDT" },
] as const

/** One brand's mark, in its own colours. */
export function Mark({ id, name, size = 22 }: { id: string; name: string; size?: number }) {
  return (
    <img
      src={`/marks/${id}.svg`}
      alt={name}
      width={size}
      height={size}
      className="inline-block shrink-0 rounded-full align-[-0.25em]"
    />
  )
}

function Item({ id, name }: { id: string; name: string }) {
  return (
    <span className="flex shrink-0 items-center gap-2 text-fd-muted-foreground">
      <Mark id={id} name="" size={24} />
      <span className="text-[14px] font-semibold whitespace-nowrap">{name}</span>
    </span>
  )
}

export function Marquee({
  items = [...BUILT_ON, ...PRICED],
  seconds = 50,
}: {
  items?: readonly { id: string; name: string }[]
  seconds?: number
}) {
  return (
    <div
      className="not-prose group overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
      aria-label={items.map((b) => b.name).join(", ")}
      role="img"
    >
      <div
        className="flex w-max group-hover:[animation-play-state:paused] motion-safe:animate-[marquee_var(--marquee)_linear_infinite]"
        style={{ "--marquee": `${seconds}s` } as CSSProperties}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-10 pe-10" aria-hidden={copy === 1}>
            {items.map((b) => (
              <Item key={b.id} id={b.id} name={b.name} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
