"use client"

// Pay links (plan 6.8 G): what the business has received through links on the stage, then one row per link with
// its amount, times paid and total. Empty: a sora tile that names the next action. Separate from its data so
// /dev/flows can show every state.
import { ChevronRight, Link2, Plus } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"

import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Stage } from "@/components/kit/stage"
import { EmptyState, ErrorState, LoadingShape, StatusPill } from "@/components/kit/states"
import { MarkStack } from "@/components/marks/mark"
import type { PayLink } from "@/lib/client/types"
import { usdUnits } from "@/lib/fiat"
import { cn } from "@/lib/utils"

/** Each link gets a story field from its id, so the list is never grey and a link keeps its colour. */
const FIELDS = ["bg-sora", "bg-matcha", "bg-sakura", "bg-kin"] as const
export const fieldOf = (id: string) =>
  FIELDS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % FIELDS.length]!

export function LinksView({
  links,
  error,
  onRetry,
  onNew,
}: {
  links: PayLink[] | undefined
  error: boolean
  onRetry: () => void
  onNew: () => void
}) {
  const reduce = useReducedMotion()
  const total = (links ?? []).reduce((sum, link) => sum + BigInt(link.paidTotal), 0n)
  const payments = (links ?? []).reduce((sum, link) => sum + link.paidCount, 0)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="display text-page-title">Pay links</h1>
        <Button variant="shu" size="md" onClick={onNew}>
          <Plus /> New pay link
        </Button>
      </header>

      {error ? (
        <ErrorState
          title="Couldn't load your pay links"
          detail="Your links still work for anyone paying them."
          onRetry={onRetry}
        />
      ) : links === undefined ? (
        <div className="flex flex-col gap-4">
          <LoadingShape shape="card" className="h-[150px] rounded-[24px]" />
          <div className="rounded-[20px] bg-card p-3">
            <LoadingShape shape="list" />
          </div>
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          art={<Link2 />}
          field="sora"
          title="No pay links yet"
          detail="Make one and anyone can pay you, from an email sign-in or a NEAR wallet."
          action={
            <Button variant="shu" onClick={onNew}>
              <Plus /> New pay link
            </Button>
          }
        />
      ) : (
        <>
          <Stage className="p-6 sm:p-8">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 text-[15px] font-medium text-white/85">
                <MarkStack ids={["usdc", "near"]} size={22} /> Received through pay links
              </span>
              <Figure
                value={viewDollars(total)}
                className="text-[56px] text-white sm:text-[72px]"
              />
              <span className="text-[15px] font-medium text-white/85">
                {links.length} {links.length === 1 ? "link" : "links"} · {payments}{" "}
                {payments === 1 ? "payment" : "payments"}
              </span>
            </div>
          </Stage>
          <div className="flex flex-col rounded-[20px] bg-card p-2">
            {links.map((link, i) => (
              <motion.div
                key={link.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <Link
                  href={`/app/links/${link.id}`}
                  className="press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
                >
                  <span
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-[14px] text-black [&_svg]:size-5",
                      fieldOf(link.id),
                    )}
                  >
                    <Link2 />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[16px] font-semibold">{link.title}</span>
                    <span className="truncate text-detail text-muted-foreground">
                      {link.amount ? usdUnits(link.amount) : "Any amount"} ·{" "}
                      {link.paidCount === 0
                        ? "Not paid yet"
                        : `Paid ${link.paidCount} ${link.paidCount === 1 ? "time" : "times"}`}
                    </span>
                  </span>
                  {link.status === "closed" ? (
                    <StatusPill tone="quiet">Paused</StatusPill>
                  ) : link.status === "paid" ? (
                    <StatusPill tone="up">Paid</StatusPill>
                  ) : null}
                  <span
                    className={cn(
                      "tnum text-[16px] font-semibold",
                      BigInt(link.paidTotal) > 0n ? "text-up" : "text-text-3",
                    )}
                  >
                    {BigInt(link.paidTotal) > 0n ? `+${usdUnits(link.paidTotal)}` : usdUnits(0)}
                  </span>
                  <ChevronRight className="size-4 text-text-3" />
                </Link>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
