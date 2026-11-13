"use client"

// One card (cards-ux-brief §4.2): a mini stage with the face and "On the card", round actions (Add money, Move back,
// Freeze, and in the Sandbox a test purchase), the month's spend against its limit, four facts and its purchases.
// Frozen collapses the actions to Unfreeze and Add money (money can wait on a frozen card).
import {
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  ShoppingBag,
  Snowflake,
  Sun,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Stage, StageAction } from "@/components/kit/stage"
import { StatusPill } from "@/components/kit/states"
import { Switch } from "@/components/kit/switch"
import { Sheet } from "@/components/shell/sheet"
import type { CardMoveView, CardPurchaseView, IssuedCardView } from "@/lib/client/types"
import { usdUnits } from "@/lib/fiat"
import { cn } from "@/lib/utils"

import { CardFace } from "./card-face"
import { PurchaseRow } from "./cards-view"

export interface CardPanelProps {
  card: IssuedCardView | null
  business: string
  sandbox: boolean
  purchases: CardPurchaseView[] | undefined
  moves: CardMoveView[] | undefined
  busy: string | null
  problem: string | null
  onOpenChange: (open: boolean) => void
  onAddMoney: () => void
  onMoveBack: () => void
  onFreeze: (frozen: boolean) => void
  onLimit: (monthlyLimit: string | null) => void
  onRename: (nickname: string) => void
  onRemove: () => void
  onTestPurchase: () => void
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-[15px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  )
}

export function CardPanel(p: CardPanelProps) {
  const card = p.card
  const [editing, setEditing] = useState<"limit" | "name" | "remove" | null>(null)
  const [limit, setLimit] = useState("")
  const [noLimit, setNoLimit] = useState(true)
  const [name, setName] = useState("")
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when another card opens.
  useEffect(() => {
    setEditing(null)
    setLimit(card?.monthlyLimit ? viewDollars(card.monthlyLimit).toFixed(2) : "")
    setNoLimit(!card?.monthlyLimit)
    setName(card?.nickname ?? "")
  }, [card?.id])
  if (!card)
    return (
      <Sheet open={false} onOpenChange={p.onOpenChange} title="Card">
        <div />
      </Sheet>
    )

  const frozen = card.status === "frozen"
  const making = card.status === "making"
  const spent = BigInt(card.spentThisMonth)
  const cap = card.monthlyLimit ? BigInt(card.monthlyLimit) : null
  const share = cap && cap > 0n ? Math.min(100, Number((spent * 100n) / cap)) : 0
  const left = cap !== null ? cap - spent : null
  const low = BigInt(card.onCard) < 5_000_000n && !making
  const pending = p.moves?.find((m) => m.status === "drafted" || m.status === "sent")

  return (
    <Sheet open onOpenChange={p.onOpenChange} title={card.nickname}>
      <div className="flex flex-col gap-5">
        <Stage className="px-4 py-5" inner="flex flex-col items-center gap-4">
          <CardFace
            tone={card.tone}
            business={p.business}
            nickname={card.nickname}
            holder={card.holderName}
            last4={card.last4}
            state={frozen ? "frozen" : making ? "making" : "active"}
            size="md"
            className="shadow-object"
          />
          <div className="flex flex-col items-center gap-0.5 text-white">
            <span className="text-[14px] font-medium text-white/85">On the card</span>
            <Figure value={viewDollars(card.onCard)} className="text-[40px] text-white" />
            {making ? (
              <span className="rounded-full bg-white/18 px-3 py-1 text-[13px]">
                Making the card
              </span>
            ) : low ? (
              <span className="rounded-full bg-white/18 px-3 py-1 text-[13px]">
                Low: {usdUnits(card.onCard)} left on the card
              </span>
            ) : null}
          </div>
          {making ? null : (
            <div className="flex flex-wrap justify-center gap-4">
              <StageAction label="Add money" icon={<ArrowDownLeft />} onClick={p.onAddMoney} />
              {frozen ? (
                <StageAction label="Unfreeze" icon={<Sun />} onClick={() => p.onFreeze(false)} />
              ) : (
                <>
                  <StageAction label="Move back" icon={<ArrowUpRight />} onClick={p.onMoveBack} />
                  <StageAction
                    label="Freeze"
                    icon={<Snowflake />}
                    onClick={() => p.onFreeze(true)}
                  />
                  {p.sandbox ? (
                    <StageAction
                      label="Test buy"
                      icon={<ShoppingBag />}
                      onClick={p.onTestPurchase}
                    />
                  ) : null}
                </>
              )}
            </div>
          )}
        </Stage>

        {p.busy ? (
          <StatusPill tone="wait" className="self-start">
            {p.busy}
          </StatusPill>
        ) : null}
        {pending ? (
          <StatusPill tone="wait" className="self-start">
            {pending.direction === "in" ? "Adding" : "Moving back"} {usdUnits(pending.amount)}
          </StatusPill>
        ) : null}
        {p.problem ? <p className="text-[15px] font-medium text-down">{p.problem}</p> : null}

        <section className="flex flex-col gap-2 rounded-[16px] bg-secondary p-4">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">This month</span>
            <button
              type="button"
              onClick={() => setEditing(editing === "limit" ? null : "limit")}
              className="text-[14px] font-semibold text-shu-ink hover:underline"
            >
              Edit limit
            </button>
          </div>
          {cap !== null ? (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-card">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-[170ms]",
                    share > 85 ? "bg-warn" : "bg-up",
                  )}
                  style={{ width: `${share}%` }}
                />
              </div>
              <span className="text-[14px] text-muted-foreground">
                {usdUnits(spent)} spent of {usdUnits(cap)} this month
              </span>
              {left !== null && left < BigInt(card.onCard) ? (
                <StatusPill tone="warn" className="self-start">
                  Only {usdUnits(left > 0n ? left : 0n)} left this month
                </StatusPill>
              ) : null}
            </>
          ) : (
            <span className="text-[14px] text-muted-foreground">
              {usdUnits(spent)} spent this month · No limit
            </span>
          )}
          {editing === "limit" ? (
            <form
              className="mt-2 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                p.onLimit(noLimit ? null : limit)
                setEditing(null)
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px]">No limit</span>
                <Switch checked={noLimit} onCheckedChange={setNoLimit} label="No limit" />
              </div>
              {noLimit ? null : (
                <Field
                  id="card-limit"
                  label="Monthly limit"
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))}
                  leading={<span className="text-[17px] font-semibold text-text-3">$</span>}
                />
              )}
              <Button type="submit" size="md" disabled={!noLimit && !(Number(limit) > 0)}>
                Save limit
              </Button>
            </form>
          ) : null}
        </section>

        <section className="flex flex-col divide-y divide-border rounded-[16px] bg-card px-4">
          <Fact label="Cardholder">
            {card.personId ? (
              <Link href={`/app/people?id=${card.personId}`} className="hover:underline">
                {card.holderName}
              </Link>
            ) : (
              card.holderName
            )}
          </Fact>
          <Fact label="Number">
            {card.last4 ? <span className="font-mono">•• {card.last4}</span> : "Being made"}
          </Fact>
          <Fact label="Spends in">
            <span className="inline-flex items-center gap-1.5">
              Dollars · <img src="/marks/visa.svg" alt="Visa" className="h-3 dark:hidden" />
              <img src="/marks/visa-white.svg" alt="Visa" className="hidden h-3 dark:inline" />
            </span>
          </Fact>
          <Fact label="Made">
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date(card.createdAt))}
          </Fact>
        </section>

        <section className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[17px] font-semibold">Purchases</h3>
            <Link
              href="/app/activity"
              className="text-[14px] font-semibold text-shu-ink hover:underline"
            >
              See all in Activity
            </Link>
          </div>
          {p.purchases?.length ? (
            p.purchases.map((purchase) => (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
                card={card}
                business={p.business}
              />
            ))
          ) : (
            <p className="px-1 py-2 text-[15px] text-muted-foreground">
              {p.sandbox ? "No purchases yet. Try a test buy." : "No purchases yet."}
            </p>
          )}
        </section>

        {editing === "name" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) p.onRename(name.trim())
              setEditing(null)
            }}
          >
            <Field
              id="card-name"
              label="Card name"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" size="md" disabled={!name.trim()}>
              Save name
            </Button>
          </form>
        ) : editing === "remove" ? (
          <div className="flex flex-col gap-3 rounded-[16px] bg-down-surface p-4">
            <p className="text-[15px] font-medium text-down">
              Remove {card.nickname}?{" "}
              {BigInt(card.onCard) > 0n
                ? `${usdUnits(card.onCard)} moves back to your balance first. `
                : ""}
              It can't be used again.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="md" onClick={() => p.onFreeze(true)}>
                Freeze instead
              </Button>
              <Button
                size="md"
                className="bg-down text-white hover:bg-down/85"
                onClick={p.onRemove}
              >
                Remove card
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setEditing("name")}
              className="press flex items-center gap-3 rounded-[14px] px-3 py-3 text-left text-[15px] font-semibold hover:bg-secondary"
            >
              <Pencil className="size-4" /> Rename
            </button>
            <button
              type="button"
              onClick={() => setEditing("remove")}
              className="press flex items-center gap-3 rounded-[14px] px-3 py-3 text-left text-[15px] font-semibold text-down hover:bg-down-surface"
            >
              <Trash2 className="size-4" /> Remove card
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
