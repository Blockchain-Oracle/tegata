"use client"

// Cards home: the business's cards fanned on the stage with "On cards" as the one
// figure, then the cards grouped "Yours" and "Your team", the latest purchases, and a quiet way to top up a crypto card
// the business already has. Picking a card opens its panel. Separate from its logic so /dev/flows can show every state.
import { ChevronRight, CreditCard, Plus, Snowflake } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { SandboxPill } from "@/components/kit/sandbox-pill"
import { Stage } from "@/components/kit/stage"
import { ErrorState, Skeleton, StatusPill } from "@/components/kit/states"
import { MarkStack } from "@/components/marks/mark"
import type { CardPurchaseView, IssuedCardView } from "@/lib/client/types"
import { usdUnits } from "@/lib/fiat"
import { cn } from "@/lib/utils"

import { CardFace } from "./card-face"

export interface CardsViewProps {
  business: string
  sandbox: boolean
  /** The card issuer, or null while cards aren't switched on for this server. */
  issuer: string | null
  cards: IssuedCardView[] | undefined
  purchases: CardPurchaseView[]
  error?: string | null
  onRetry?: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  onNewCard: () => void
  onLinked: () => void
}

/** "$X left this month", "No limit", or the frozen chip. */
export function cardSubline(card: IssuedCardView) {
  if (card.status === "frozen") return null
  if (!card.monthlyLimit) return "No limit"
  const left = BigInt(card.monthlyLimit) - BigInt(card.spentThisMonth)
  return `${usdUnits(left > 0n ? left : 0n)} left this month`
}

export function CardRow({
  card,
  business,
  selected,
  onClick,
}: {
  card: IssuedCardView
  business: string
  selected: boolean
  onClick: () => void
}) {
  const sub = cardSubline(card)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "press flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left hover:bg-secondary",
        selected && "bg-shu-wash hover:bg-shu-wash",
      )}
    >
      <CardFace
        tone={card.tone}
        business={business}
        nickname={card.nickname}
        holder={card.holderName}
        last4={card.last4}
        state={card.status === "frozen" ? "frozen" : card.status === "making" ? "making" : "active"}
        size="thumb"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[17px] font-semibold">{card.nickname}</span>
        <span className="truncate text-[14px] text-muted-foreground">
          {card.holderName}
          {card.last4 ? (
            <>
              {" · "}
              <span className="font-mono">•• {card.last4}</span>
            </>
          ) : card.status === "making" ? (
            " · Making the card"
          ) : null}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="tnum text-[16px] font-semibold">{usdUnits(card.onCard)}</span>
        {sub ? (
          <span className="text-[12px] text-text-3">{sub}</span>
        ) : (
          <StatusPill tone="quiet" className="gap-1">
            <Snowflake className="size-3" /> Frozen
          </StatusPill>
        )}
      </span>
    </button>
  )
}

/** Up to three faces fanned on the stage (−8°, 0°, +8°), the owner's on top. */
function Fan({ cards, business }: { cards: IssuedCardView[]; business: string }) {
  const reduce = useReducedMotion()
  const shown = cards.slice(0, 3)
  const angles = shown.length === 1 ? [3] : shown.length === 2 ? [-6, 6] : [-8, 0, 8]
  return (
    <div className="relative mx-auto h-[190px] w-full max-w-[360px] sm:h-[220px]">
      {shown
        .map((card, i) => ({ card, i }))
        .reverse()
        .map(({ card, i }) => (
          <motion.div
            key={card.id}
            className="absolute inset-x-0 top-2 mx-auto w-[82%] sm:w-[88%]"
            style={{ zIndex: 10 - i }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, rotate: 0 }}
            animate={{
              opacity: 1,
              y: i * 14,
              rotate: angles[i] ?? 0,
              x: (i - (shown.length - 1) / 2) * 26,
            }}
            transition={{ duration: 0.32, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <CardFace
              tone={card.tone}
              business={business}
              nickname={card.nickname}
              holder={card.holderName}
              last4={card.last4}
              state={
                card.status === "frozen" ? "frozen" : card.status === "making" ? "making" : "active"
              }
              size="hero"
              className="shadow-object"
            />
          </motion.div>
        ))}
      {cards.length > 3 ? (
        <span className="absolute top-0 right-0 z-20 rounded-full bg-white px-2.5 py-1 text-[13px] font-semibold text-black shadow-object">
          +{cards.length - 3}
        </span>
      ) : null}
    </div>
  )
}

/** Blank faces in three story colours, with only the business's seal: what cards will look like. */
function BlankFan({ business }: { business: string }) {
  const tones = ["matcha", "sora", "sakura"] as const
  return (
    <div className="relative mx-auto h-[190px] w-full max-w-[360px] sm:h-[220px]">
      {tones.map((tone, i) => (
        <div
          key={tone}
          className="absolute inset-x-0 top-2 mx-auto w-[82%] sm:w-[88%]"
          style={{
            zIndex: 10 - i,
            transform: `translate(${(i - 1) * 26}px, ${i * 14}px) rotate(${[-8, 0, 8][i]}deg)`,
          }}
        >
          {/* The tilt sits on the outer box, the drift on the inner one, so the animation can't undo the tilt. */}
          <div className="animate-drift" style={{ animationDelay: `${i * 0.6}s` }}>
            <CardFace
              tone={tone}
              business={business}
              nickname=" "
              holder=" "
              last4="    "
              size="hero"
              className="shadow-object"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardsView(p: CardsViewProps) {
  const cards = p.cards ?? []
  const live = cards.filter((c) => c.status !== "removed")
  const yours = live.filter((c) => !c.personId)
  const team = live.filter((c) => c.personId)
  const removed = cards.filter((c) => c.status === "removed")
  const onCards = live.reduce((sum, c) => sum + BigInt(c.onCard), 0n)
  const spent = live.reduce((sum, c) => sum + BigInt(c.spentThisMonth), 0n)
  const byId = new Map(cards.map((c) => [c.id, c]))

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="display text-page-title">Cards</h1>
        {p.sandbox ? (
          <SandboxPill className="hidden sm:inline-flex">Sandbox · test cards</SandboxPill>
        ) : null}
        {p.issuer && p.cards !== undefined ? (
          <Button size="sm" className="ml-auto" onClick={p.onNewCard}>
            <Plus /> New card
          </Button>
        ) : null}
      </div>

      {p.cards === undefined && !p.error ? (
        <div className="flex flex-col gap-4" role="status" aria-label="Loading cards">
          <Skeleton className="h-[280px] rounded-[24px]" />
          <Skeleton className="h-16 rounded-[16px]" />
          <Skeleton className="h-16 rounded-[16px]" />
        </div>
      ) : p.error && p.cards === undefined ? (
        <ErrorState
          title="Cards didn't load"
          detail={p.error}
          stillWorks="Cards still work at shops."
          onRetry={p.onRetry}
        />
      ) : (
        <>
          <Stage
            tone="lacquer"
            className="px-5 py-7 sm:px-8"
            inner="grid items-center gap-6 sm:grid-cols-[1.2fr_1fr]"
          >
            {live.length ? (
              <Fan cards={[...yours, ...team]} business={p.business} />
            ) : (
              <BlankFan business={p.business} />
            )}
            <div className="flex flex-col gap-2 text-white">
              {live.length ? (
                <>
                  <span className="text-[15px] font-medium text-white/85">On cards</span>
                  <Figure value={viewDollars(onCards)} className="text-[52px] text-white" />
                  <span className="text-[15px] text-white/85">
                    {usdUnits(spent)} spent this month across {live.length}{" "}
                    {live.length === 1 ? "card" : "cards"}
                  </span>
                </>
              ) : p.issuer ? (
                <>
                  <span className="display text-[34px] leading-[1.05]">
                    Cards for you and your team
                  </span>
                  <span className="text-[15px] text-white/85">
                    Each card spends only what you put on it.
                  </span>
                  <Button
                    className="mt-2 self-start bg-black text-white hover:bg-black/85"
                    onClick={p.onNewCard}
                  >
                    <Plus /> New card
                  </Button>
                </>
              ) : (
                <>
                  <span className="display text-[34px] leading-[1.05]">
                    Cards for you and your team
                  </span>
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[14px] font-medium">
                    <CreditCard className="size-4" /> Opening soon
                  </span>
                </>
              )}
            </div>
          </Stage>

          {yours.length ? (
            <section className="flex flex-col gap-1">
              <h2 className="px-1 text-[17px] font-semibold">Yours</h2>
              {yours.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  business={p.business}
                  selected={p.selectedId === card.id}
                  onClick={() => p.onSelect(card.id)}
                />
              ))}
            </section>
          ) : null}
          {live.length ? (
            <section className="flex flex-col gap-1">
              <h2 className="px-1 text-[17px] font-semibold">Your team</h2>
              {team.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  business={p.business}
                  selected={p.selectedId === card.id}
                  onClick={() => p.onSelect(card.id)}
                />
              ))}
              {team.length === 0 && p.issuer ? (
                <button
                  type="button"
                  onClick={p.onNewCard}
                  className="press flex items-center gap-3 rounded-[16px] border-2 border-dashed border-border px-3 py-3 text-left"
                >
                  <span className="grid h-[35px] w-[56px] place-items-center rounded-[8px] bg-matcha text-field-ink">
                    <Plus className="size-4" />
                  </span>
                  <span className="flex-1 text-[15px] font-semibold">
                    Give someone on your team a card
                  </span>
                </button>
              ) : null}
            </section>
          ) : null}

          {p.purchases.length ? (
            <section className="flex flex-col gap-1">
              <h2 className="px-1 text-[17px] font-semibold">Latest purchases</h2>
              <ul className="flex flex-col">
                {p.purchases.slice(0, 5).map((purchase) => {
                  const card = byId.get(purchase.cardId)
                  return (
                    <li key={purchase.id}>
                      <PurchaseRow purchase={purchase} card={card} business={p.business} />
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <button
            type="button"
            onClick={p.onLinked}
            className="press flex items-center gap-3 rounded-[16px] bg-card px-3 py-3 text-left shadow-[0_0_0_1px_var(--border)]"
          >
            <MarkStack ids={["gnosis", "usdc"]} size={28} />
            <span className="flex-1 text-[15px] font-semibold">
              Already have a crypto card? Top it up
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>

          {removed.length ? (
            <details className="group rounded-[16px] px-1">
              <summary className="cursor-pointer list-none py-2 text-[15px] font-semibold text-muted-foreground">
                Removed cards ({removed.length})
              </summary>
              {removed.map((card) => (
                <div key={card.id} className="flex items-center gap-3 px-2 py-2">
                  <CardFace
                    tone={card.tone}
                    business={p.business}
                    nickname={card.nickname}
                    holder={card.holderName}
                    last4={card.last4}
                    state="removed"
                    size="thumb"
                  />
                  <span className="text-[14px] text-muted-foreground">
                    {card.nickname} · {card.holderName}
                  </span>
                </div>
              ))}
            </details>
          ) : null}
        </>
      )}
    </div>
  )
}

const PURCHASE_WORD: Record<CardPurchaseView["kind"], string> = {
  authorization: "Pending",
  settlement: "Paid",
  reversal: "Reversed",
  declined: "Declined",
}

export function PurchaseRow({
  purchase,
  card,
  business,
}: {
  purchase: CardPurchaseView
  card: IssuedCardView | undefined
  business: string
}) {
  const declined = purchase.kind === "declined"
  return (
    <div className="flex items-center gap-3 rounded-[14px] px-3 py-2.5">
      {card ? (
        <CardFace
          tone={card.tone}
          business={business}
          nickname={card.nickname}
          holder={card.holderName}
          last4={card.last4}
          size="thumb"
        />
      ) : (
        <span className="h-[35px] w-[56px] rounded-[8px] bg-secondary" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">
          {purchase.merchant ?? "Card purchase"}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">
          {card ? `${card.nickname} · ` : ""}
          {declined && purchase.reason
            ? `Declined: ${purchase.reason}`
            : PURCHASE_WORD[purchase.kind]}
        </span>
      </span>
      <span
        className={cn(
          "tnum text-[15px] font-semibold",
          declined && "text-muted-foreground line-through",
          purchase.kind === "reversal" && "text-up",
        )}
      >
        {purchase.amount
          ? `${purchase.kind === "reversal" ? "+" : "−"}${usdUnits(purchase.amount)}`
          : "—"}
      </span>
    </div>
  )
}
