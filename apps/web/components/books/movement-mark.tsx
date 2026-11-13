"use client"

// One mark per movement: Home's "Latest" and Activity draw the same movement the
// same way. The mark is the other side or the way the money moved: the payer's rail for money in (the Tegata seal, the
// NEAR mark, the coin and chain it came from), the NEAR mark for a send, the coin and chain for a payout to another
// chain, the business's seal for payroll and payslips, the Tegata seal for what Tegata paid, a flag for a bank.
import { Landmark } from "lucide-react"

import { Flag } from "@/components/bank/parts"
import { BusinessSeal, TegataSeal } from "@/components/brand/seal"
import { Mark } from "@/components/marks/mark"
import { type PaidRail, PaidWithMark } from "@/components/marks/paid-with"
import type { ActivityItem, MovementKind, MovementView } from "@/lib/client/types"
import { fiatMoney } from "@/lib/fiat"
import { addressLooksRight, PAYER_ROUTES, routeOf } from "@/lib/routes"

/** Fields the server may add to a movement; read when present, inferred when not. */
export interface MovementExtras {
  /** How a payment in was made. */
  rail?: PaidRail | null
  /** Paid through NEAR Intents: the 1Click asset the payer sent. */
  assetIn?: string | null
  /** A bank movement's currency ("NGN"). */
  fiat?: string | null
}

export interface MovementSubject {
  kind: MovementKind
  title: string | null
  counterparty: string | null
  /** The other side's NEAR account or address. */
  account: string | null
  rail: PaidRail | null
  assetIn: string | null
  fiat: string | null
}

const HOME_KIND: Record<ActivityItem["kind"], MovementKind> = {
  send: "send",
  paid: "payment_out",
  received: "payment_in",
  reward: "reward",
  payroll: "payroll",
  payslip: "payslip",
}

export function subjectOfMovement(m: MovementView & MovementExtras): MovementSubject {
  return {
    kind: m.kind,
    title: m.title,
    counterparty: m.counterparty,
    account: m.counterpartyAccount,
    rail: m.rail ?? m.refundable?.rail ?? null,
    assetIn: m.assetIn ?? m.refundable?.assetIn ?? null,
    fiat: m.fiat ?? null,
  }
}

export function subjectOfActivity(item: ActivityItem & MovementExtras): MovementSubject {
  const kind = HOME_KIND[item.kind]
  return {
    kind,
    title: item.title,
    counterparty: item.counterparty,
    account: kind === "payment_in" || kind === "send" ? item.counterparty : null,
    rail: item.rail ?? null,
    assetIn: item.assetIn ?? null,
    fiat: item.fiat ?? null,
  }
}

const IMPLICIT = /^[0-9a-f]{64}$/
const NEAR_NAME = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(near|testnet)$/

/** "4f7a2c…9e01" for an implicit account or a long address; a named NEAR account (or any name) stays whole. */
export function shortAccount(id: string): string {
  if (IMPLICIT.test(id) || (id.length > 24 && !/[.\s]/.test(id)))
    return `${id.slice(0, 6)}…${id.slice(-4)}`
  return id
}

/** How a payment was made, from who paid: a Tegata account, a NEAR wallet, an address on another chain, or a note. */
function railOfPayer(payer: string | null): PaidRail {
  if (!payer) return "manual"
  if (/\.tegata\.(near|testnet)$/.test(payer)) return "tegata"
  if (NEAR_NAME.test(payer) || IMPLICIT.test(payer)) return "near_wallet"
  if (["tron", "btc", "eth", "sol"].some((chain) => addressLooksRight(chain, payer)))
    return "oneclick"
  return "manual"
}

/** The asset an address must have paid in, when only one route reaches its chain (Tron: USDT; Bitcoin: BTC). */
function onlyAssetFor(address: string | null): string | null {
  if (!address) return null
  // Tron and Bitcoin addresses can't be mistaken for another chain's; EVM and Solana ones can.
  const chain = ["tron", "btc"].find((c) => addressLooksRight(c, address))
  const routes = chain ? PAYER_ROUTES.filter((r) => r.chainMark === chain) : []
  return routes.length === 1 ? (routes[0]?.assetId ?? null) : null
}

const FIAT_IN_TITLE = /\s*\(([\d.]+) ([A-Z]{3})\)$/

/** "To Access Bank (26765.5 NGN)" → "To Access Bank · ₦26,765.50": local money in its own sign. */
export function movementTitle(title: string): string {
  return title.replace(
    FIAT_IN_TITLE,
    (_, amount: string, fiat: string) => ` · ${fiatMoney(fiat, amount)}`,
  )
}

/** The coin and chain a payout went out in, from its title ("USDT on Tron", "Refund in USDT on Tron"). */
function payoutRoute(title: string | null) {
  const found = title?.match(/^(?:Refund in )?(\S+) on (.+)$/)
  return found ? routeOf(found[1] ?? null, found[2] ?? null) : null
}

function Disc({
  size,
  label,
  className = "bg-white",
  children,
}: {
  size: number
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={`grid shrink-0 place-items-center rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.06)] ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  )
}

export function MovementMark({
  movement: m,
  business,
  size = 40,
}: {
  movement: MovementSubject
  /** This business's own name, for its payroll runs. */
  business?: string
  size?: number
}) {
  const seal = (name: string) => (
    <Disc size={size} label={`${name} seal`}>
      <BusinessSeal name={name} size={Math.round(size * 0.92)} tilt={0} />
    </Disc>
  )
  switch (m.kind) {
    case "payment_in": {
      const rail = m.rail ?? railOfPayer(m.account)
      return (
        <PaidWithMark
          rail={rail}
          assetIn={m.assetIn ?? (rail === "oneclick" ? onlyAssetFor(m.account) : null)}
          size={size}
        />
      )
    }
    case "payment_out":
      return seal(m.counterparty ?? "A business")
    case "payslip":
      return seal(m.counterparty ?? "Your employer")
    case "payroll":
      return m.title?.includes("by autopilot") ? (
        <Mark id="near" size={size} label="Paid by autopilot on NEAR" />
      ) : (
        seal(business ?? "Your business")
      )
    case "reward":
    case "test_dollars":
      return (
        <Disc size={size} label="From Tegata">
          <TegataSeal size={Math.round(size * 0.62)} textured={false} tilt={0} />
        </Disc>
      )
    case "bank_out":
    case "bank_in": {
      const fiat = m.fiat ?? m.title?.match(FIAT_IN_TITLE)?.[2] ?? null
      return fiat ? (
        <Flag code={fiat} size={size} label={`${fiat} bank`} />
      ) : (
        <Disc size={size} label="Bank" className="bg-kin text-field-ink">
          <Landmark style={{ width: size * 0.45, height: size * 0.45 }} />
        </Disc>
      )
    }
    case "send":
    case "refund": {
      const route = payoutRoute(m.title)
      return route ? (
        <Mark
          id={route.coin}
          chain={route.chainMark}
          size={size}
          label={`${route.symbol} on ${route.chain}`}
        />
      ) : (
        <Mark id="near" size={size} />
      )
    }
    default:
      // Set aside in or back from autopilot: the contract on NEAR.
      return <Mark id="near" size={size} label="Autopilot on NEAR" />
  }
}
