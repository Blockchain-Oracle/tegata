"use client"

// Cards (plan 6.8 AD): a Gnosis Pay card the business already has, on the stage as a card with its live balance on the
// Gnosis chain, topped up from the NEAR balance through NEAR Intents; and issuing Tegata cards, which opens when Gnosis
// Pay approves Tegata's sandbox. Separate from its logic so /dev/flows can show every state.
import {
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Lock,
  Plus,
  Snowflake,
  Trash2,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Stage } from "@/components/kit/stage"
import { StatusPill } from "@/components/kit/states"
import { Mark } from "@/components/marks/mark"
import type { PayoutView } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

export interface CardView {
  id: string
  label: string
  account: string
  provider: string
  balances: { usdc: string; eure: string } | null
  topUps: PayoutView[]
}

export interface CardsViewProps {
  live: boolean
  cards: CardView[] | undefined
  linking: boolean
  problem: string | null
  onLink: (input: { account: string; label: string }) => void
  onUnlink: (id: string) => void
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** The card object: a Tegata-styled face for the Gnosis Pay card the business linked. */
function CardFace({ card }: { card: CardView }) {
  return (
    <div className="relative aspect-[1.586] w-full max-w-[360px] overflow-hidden rounded-[22px] bg-[radial-gradient(120%_90%_at_10%_0%,#2b2b2b_0%,#0b0b0b_60%)] p-5 text-white shadow-[0_18px_40px_rgba(80,20,0,0.35)]">
      <span className="absolute -top-16 -right-16 size-48 rounded-full bg-shu/35 blur-2xl" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="flex items-center gap-2 text-[15px] font-semibold">
            <TegataSeal size={26} textured={false} /> {card.label}
          </span>
          <Mark id="gnosis" size={26} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[18px] tracking-[0.18em]">
            •••• •••• {card.account.slice(-4).toUpperCase()}
          </span>
          <span className="flex items-center justify-between text-[12px] font-semibold text-white/75">
            <span>Gnosis Pay</span>
            <span className="text-[16px] font-black italic text-white">VISA</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function CopyAddress({ account }: { account: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(account)
        fire("tick", { cue: "confirmed" })
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
      className="press inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1.5 text-[13px] font-semibold text-white"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {short(account)}
    </button>
  )
}

export function CardsView(p: CardsViewProps) {
  const [adding, setAdding] = useState(false)
  const [account, setAccount] = useState("")
  const [label, setLabel] = useState("")
  const showForm = adding || p.cards?.length === 0
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <h1 className="display text-page-title">Cards</h1>

      {p.cards?.map((card) => {
        const topUp = `/app/send?mode=chain&route=usdc-gnosis&to=${card.account}`
        return (
          <section key={card.id} className="flex flex-col gap-4">
            <Stage className="p-5 sm:p-7">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <CardFace card={card} />
                <div className="flex flex-col gap-2">
                  <span className="text-[15px] font-medium text-white/85">On the card</span>
                  {card.balances ? (
                    <>
                      <Figure
                        value={Number(card.balances.usdc)}
                        className="text-[52px] text-white"
                      />
                      {Number(card.balances.eure) > 0 ? (
                        <span className="text-[15px] font-semibold text-white">
                          + €{Number(card.balances.eure).toFixed(2)} EURe
                        </span>
                      ) : null}
                      <span className="text-detail text-white/80">
                        USDC on Gnosis, read from the chain
                      </span>
                    </>
                  ) : (
                    <span className="text-[15px] text-white/85">
                      The Gnosis chain didn't answer. Try again.
                    </span>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.live ? (
                      <Link
                        href={topUp}
                        className="press inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold text-black [&_svg]:size-4"
                      >
                        <Plus /> Top up from NEAR
                      </Link>
                    ) : null}
                    <CopyAddress account={card.account} />
                  </div>
                </div>
              </div>
            </Stage>
            {!p.live ? (
              <p className="text-detail text-muted-foreground">
                Top-ups run in Live: NEAR Intents has no testnet. Switch to Live at the top to top
                this card up from your NEAR balance.
              </p>
            ) : (
              <p className="flex items-start gap-2 text-detail text-muted-foreground">
                <Mark id="intents" size={16} className="mt-0.5" />A top-up leaves your NEAR balance
                in one gas-free approval and NEAR Intents delivers it as USDC on Gnosis, ready to
                spend wherever Visa works.
              </p>
            )}
            {card.topUps.length ? (
              <ul className="flex flex-col divide-y divide-secondary rounded-[16px] bg-card px-4">
                {card.topUps.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="flex flex-col">
                      <span className="text-[15px] font-semibold">
                        Top-up ${viewDollars(t.amount).toFixed(2)}
                      </span>
                      <span className="text-detail text-muted-foreground">
                        {new Date(t.createdAt).toLocaleString(undefined, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {t.amountOutFormatted ? ` · ${t.amountOutFormatted} USDC arrived` : ""}
                      </span>
                    </span>
                    <StatusPill
                      tone={
                        t.status === "delivered"
                          ? "up"
                          : t.status === "refunded" || t.status === "failed"
                            ? "down"
                            : "wait"
                      }
                    >
                      {t.status === "delivered"
                        ? "On the card"
                        : t.status === "refunded"
                          ? "Came back"
                          : t.status === "failed"
                            ? "Failed"
                            : "On its way"}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" asChild>
                <a
                  href={`https://gnosisscan.io/address/${card.account}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink /> The card account on Gnosis
                </a>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => p.onUnlink(card.id)}>
                <Trash2 /> Unlink
              </Button>
            </div>
          </section>
        )
      })}

      {showForm ? (
        <section className="flex flex-col gap-4 rounded-[24px] bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5" />
            <h2 className="text-[17px] font-semibold">Link your Gnosis Pay card</h2>
          </div>
          <p className="text-[15px] text-muted-foreground">
            A Gnosis Pay card spends the USDC in its own account on the Gnosis chain, anywhere Visa
            works. Paste that account's address (it starts 0x) and top it up straight from your NEAR
            balance.
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              p.onLink({ account, label })
            }}
          >
            <Field
              id="card-label"
              label="Name (optional)"
              placeholder="Team card"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <Field
              id="card-account"
              label="Card account address on Gnosis"
              placeholder="0x…"
              value={account}
              onChange={(e) => setAccount(e.target.value.trim())}
              className="font-mono"
              spellCheck={false}
              autoCapitalize="none"
              leading={<Mark id="gnosis" size={22} />}
              status={p.problem ? { kind: "bad", text: p.problem } : { kind: "none" }}
            />
            <Button type="submit" busy={p.linking} disabled={!/^0x[0-9a-fA-F]{40}$/.test(account)}>
              <Wallet /> Link the card
            </Button>
          </form>
        </section>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Plus /> Link another card
        </Button>
      )}

      <section className="flex flex-col gap-4 rounded-[24px] bg-secondary p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[17px] font-semibold">
            <TegataSeal size={22} textured={false} /> Tegata cards
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[13px] font-semibold">
            <Lock className="size-3.5" /> Waiting on Gnosis Pay
          </span>
        </div>
        <p className="text-[15px] text-muted-foreground">
          Issue cards to your business and your people, spending straight from USDC. Opens when
          Gnosis Pay approves Tegata's sandbox (requested 13 Nov; they review every company first).
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            {
              icon: <CreditCard />,
              text: "A virtual card for you and each person, ready in seconds",
            },
            {
              icon: <Lock />,
              text: "The number shown only to the cardholder, by Gnosis Pay, never by Tegata",
            },
            { icon: <Snowflake />, text: "Freeze and set a monthly limit per card" },
            {
              icon: <Wallet />,
              text: "Every card purchase as a row in Activity, with its receipt",
            },
          ].map((item) => (
            <li
              key={item.text}
              className="flex items-start gap-3 rounded-[14px] bg-card px-4 py-3 text-[14px] [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0"
            >
              {item.icon}
              {item.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
