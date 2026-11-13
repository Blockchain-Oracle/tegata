"use client"

// Where a person's pay lands, said the same way everywhere: the People rows, a person's sheet, the run review and the
// person's own page. A Tegata account shows the seal, a NEAR account the NEAR mark, another chain the coin with its
// chain's badge ("USDT on Tron").
import { TegataSeal } from "@/components/brand/seal"
import { StatusPill } from "@/components/kit/states"
import { Mark } from "@/components/marks/mark"
import type { DestinationKind, PayReadiness, PendingDestination } from "@/lib/client/types"
import { PAYER_ROUTES } from "@/lib/routes"

/** "Sat 14:00": when a waiting change takes over, in the reader's clock. */
export const changesOn = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })

export const routeById = (route: string | null | undefined) =>
  route ? PAYER_ROUTES.find((r) => r.id === route) : undefined

/** "T9yD…3kPq": an address on another chain, short enough for a row. */
export const shortAddress = (address: string) =>
  address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address

export function DestinationMark({
  kind,
  route,
  size = 20,
}: {
  kind: DestinationKind
  route?: string | null
  size?: number
}) {
  if (kind === "tegata")
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-white shadow-object"
        style={{ width: size, height: size }}
        role="img"
        aria-label="Tegata account"
      >
        <TegataSeal size={Math.round(size * 0.66)} textured={false} tilt={0} />
      </span>
    )
  if (kind === "chain") {
    const found = routeById(route)
    return found ? (
      <Mark id={found.coin} chain={found.chainMark} size={size} />
    ) : (
      <Mark id="intents" size={size} />
    )
  }
  return <Mark id="near" size={size} />
}

export const KIND_WORD = {
  tegata: "Tegata account",
  near: "NEAR account",
  chain: "address on another chain",
} as const

/** "Tegata account", "NEAR account", or "USDT on Tron" for another chain. */
export function destinationWord(kind: DestinationKind, route?: string | null) {
  if (kind !== "chain") return KIND_WORD[kind]
  const found = routeById(route)
  return found ? `${found.symbol} on ${found.chain}` : "another chain"
}

/** The pill on a team row: ready, opening, or waiting for them to choose. */
export function DestinationPill({
  ready,
  pending,
  hasEmail,
}: {
  ready: PayReadiness
  pending: PendingDestination | null
  hasEmail: boolean
}) {
  if (pending) return <StatusPill tone="warn">Changes {changesOn(pending.activatesAt)}</StatusPill>
  if (ready.state === "ready")
    return (
      <StatusPill tone="up" className="gap-1.5">
        <DestinationMark kind={ready.kind} route={ready.route} size={14} />
        {ready.kind === "chain" ? destinationWord("chain", ready.route) : "Ready"}
      </StatusPill>
    )
  if (ready.state === "opening") return <StatusPill tone="wait">Getting ready</StatusPill>
  return <StatusPill tone="quiet">{hasEmail ? "Waiting for them" : "Needs an account"}</StatusPill>
}
