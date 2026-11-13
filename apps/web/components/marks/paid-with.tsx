// How a payment was made, as one mark (audit S3): the seal for a Tegata balance, NEAR for a NEAR wallet, the coin that
// was actually sent (with its chain) for a payment through NEAR Intents, and a kin disc for one recorded by hand.
import { HandCoins } from "lucide-react"

import { TegataSeal } from "@/components/brand/seal"
import { Mark } from "@/components/marks/mark"
import { routeOfAsset } from "@/lib/routes"

export type PaidRail = "tegata" | "near_wallet" | "oneclick" | "manual"

export function PaidWithMark({
  rail,
  assetIn,
  size = 40,
}: {
  rail: PaidRail
  /** For a payment through NEAR Intents: the 1Click asset id the payer sent. */
  assetIn?: string | null
  size?: number
}) {
  if (rail === "tegata")
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-white shadow-object"
        style={{ width: size, height: size }}
        role="img"
        aria-label="Paid from a Tegata balance"
      >
        <TegataSeal size={Math.round(size * 0.62)} textured={false} tilt={0} />
      </span>
    )
  if (rail === "manual")
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-kin text-black"
        style={{ width: size, height: size }}
        role="img"
        aria-label="Paid by hand"
      >
        <HandCoins style={{ width: size * 0.5, height: size * 0.5 }} />
      </span>
    )
  if (rail === "near_wallet") return <Mark id="near" size={size} label="Paid from a NEAR wallet" />
  const route = routeOfAsset(assetIn)
  return route ? (
    <Mark
      id={route.coin}
      chain={route.chainMark}
      size={size}
      label={`${route.symbol} on ${route.chain}`}
    />
  ) : (
    <Mark id="intents" size={size} label="Through NEAR Intents" />
  )
}

/** "USDT on Tron" for a payment through NEAR Intents, else null. */
export function paidVia(assetIn?: string | null): string | null {
  const route = routeOfAsset(assetIn)
  return route ? `${route.symbol} on ${route.chain}` : null
}
