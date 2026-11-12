"use client"

// Where a person's pay lands, said the same way everywhere: the People rows, a person's sheet, the run review and the
// person's own page. A Tegata account shows the seal, a NEAR account the NEAR mark.
import { TegataSeal } from "@/components/brand/seal"
import { StatusPill } from "@/components/kit/states"
import { Mark } from "@/components/marks/mark"
import type { PayReadiness, PendingDestination } from "@/lib/client/types"

/** "Sat 14:00": when a waiting change takes over, in the reader's clock. */
export const changesOn = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })

export function DestinationMark({ kind, size = 20 }: { kind: "tegata" | "near"; size?: number }) {
  return kind === "tegata" ? (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-white shadow-object"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Tegata account"
    >
      <TegataSeal size={Math.round(size * 0.66)} textured={false} tilt={0} />
    </span>
  ) : (
    <Mark id="near" size={size} />
  )
}

export const KIND_WORD = { tegata: "Tegata account", near: "NEAR account" } as const

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
        <DestinationMark kind={ready.kind} size={14} /> Ready
      </StatusPill>
    )
  if (ready.state === "opening") return <StatusPill tone="wait">Getting ready</StatusPill>
  return <StatusPill tone="quiet">{hasEmail ? "Waiting for them" : "Needs an account"}</StatusPill>
}
