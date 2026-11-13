"use client"

// A crypto card the business already has (plan 6.8 AD, the secondary path): a Gnosis Pay card account on the Gnosis
// chain, shown with its live balance and topped up from the NEAR balance through NEAR Intents. It lives in a sheet off
// the Cards page ("Already have a crypto card? Top it up"); Tegata's own cards are the page itself.
import { Check, Copy, CreditCard, ExternalLink, Plus, Trash2, Wallet } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { CardFace } from "@/components/cards/card-face"
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

export function LinkedCards(p: CardsViewProps) {
  const [adding, setAdding] = useState(false)
  const [account, setAccount] = useState("")
  const [label, setLabel] = useState("")
  const showForm = adding || p.cards?.length === 0
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      {p.cards?.map((card) => {
        const topUp = `/app/send?mode=chain&route=usdc-gnosis&to=${card.account}`
        return (
          <section key={card.id} className="flex flex-col gap-4">
            <Stage className="p-5 sm:p-7">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <CardFace
                  tone="ink"
                  business=""
                  nickname={card.label}
                  holder={short(card.account)}
                  last4={null}
                  state="linked"
                  issuer="Gnosis Pay"
                />
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
    </div>
  )
}
