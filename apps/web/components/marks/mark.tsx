// Real marks (plan 6.10, D-R4): a chain, coin or partner logo in its own colours, never tinted. An optional chain
// badge sits in the bottom corner ("USDT on Tron"). Unknown ids fall back to the widget's own "unknown" mark.
import { cn } from "@/lib/utils"

export const MARKS = {
  near: "NEAR",
  intents: "NEAR Intents",
  usdc: "USDC",
  usdt: "USDT",
  eth: "Ethereum",
  base: "Base",
  arb: "Arbitrum",
  sol: "Solana",
  btc: "Bitcoin",
  tron: "Tron",
  op: "Optimism",
  pol: "Polygon",
  avax: "Avalanche",
  bnb: "BNB Chain",
  xrp: "XRP",
  ton: "TON",
  doge: "Dogecoin",
  sui: "Sui",
  ltc: "Litecoin",
  zec: "Zcash",
  gnosis: "Gnosis",
  aurora: "Aurora",
  stellar: "Stellar",
  ada: "Cardano",
  bera: "Berachain",
  mon: "Monad",
  dai: "DAI",
  wbtc: "Wrapped Bitcoin",
  google: "Google",
  circle: "Circle",
  unknown: "Unknown",
} as const

export type MarkId = keyof typeof MARKS

/** Marks drawn edge to edge in a square need a round crop; the widget's marks are already round or squircle. */
const SQUARE: ReadonlySet<MarkId> = new Set(["near", "intents", "google", "circle"])

export function Mark({
  id,
  size = 32,
  chain,
  className,
  label,
}: {
  id: MarkId | string
  size?: number
  /** A small chain mark in the corner. */
  chain?: MarkId | string
  className?: string
  label?: string
}) {
  const known = (id in MARKS ? id : "unknown") as MarkId
  const badge = chain && chain !== id ? ((chain in MARKS ? chain : "unknown") as MarkId) : null
  const badgeSize = Math.round(size * 0.44)
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? (badge ? `${MARKS[known]} on ${MARKS[badge]}` : MARKS[known])}
    >
      <img
        src={`/marks/${known}.svg`}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className={cn(
          "size-full select-none",
          SQUARE.has(known) ? "rounded-[28%]" : "rounded-full",
        )}
      />
      {badge ? (
        <img
          src={`/marks/${badge}.svg`}
          alt=""
          width={badgeSize}
          height={badgeSize}
          draggable={false}
          className={cn(
            "absolute -right-0.5 -bottom-0.5 select-none ring-2 ring-card",
            SQUARE.has(badge) ? "rounded-[28%]" : "rounded-full",
          )}
          style={{ width: badgeSize, height: badgeSize }}
        />
      ) : null}
    </span>
  )
}

/** Overlapping marks ("pay from any of these"), each over the last. */
export function MarkStack({
  ids,
  size = 28,
  className,
}: {
  ids: readonly (MarkId | string)[]
  size?: number
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      {ids.map((m, i) => (
        <span
          key={m}
          className="rounded-full ring-2 ring-card"
          style={{ marginLeft: i === 0 ? 0 : -size * 0.28 }}
        >
          <Mark id={m} size={size} />
        </span>
      ))}
    </span>
  )
}
