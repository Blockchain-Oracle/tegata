"use client"

// Cards in every state, on sample data only: no issuer yet, no cards, the owner's
// card alone, a team, a card's panel (active, frozen), adding money and moving back, and making a card.
import { useState } from "react"

import { CardMoneySheet } from "@/components/cards/card-money-sheet"
import { CardPanel } from "@/components/cards/card-panel"
import { CardsView } from "@/components/cards/cards-view"
import { NewCardSheet, type NewCardStep } from "@/components/cards/new-card-sheet"
import { Segmented } from "@/components/kit/segmented"
import { SAMPLE_CARDS } from "@/lib/dev/sample"

type State = "waiting" | "empty" | "one" | "team" | "loading"

export default function CardsFlow() {
  const [state, setState] = useState<State>("team")
  const [selected, setSelected] = useState<string | null>(null)
  const [money, setMoney] = useState<"in" | "out" | null>(null)
  const [creating, setCreating] = useState(false)
  const [step, setStep] = useState<NewCardStep>("form")
  const [progress, setProgress] = useState(0)
  const cards =
    state === "loading"
      ? undefined
      : state === "waiting" || state === "empty"
        ? []
        : state === "one"
          ? SAMPLE_CARDS.cards.slice(0, 1)
          : SAMPLE_CARDS.cards
  const card = SAMPLE_CARDS.cards.find((c) => c.id === selected) ?? null
  return (
    <div className="flex flex-col gap-8 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="display text-[30px]">Cards</span>
        <Segmented
          label="Cards state"
          value={state}
          onValueChange={(v) => setState(v as State)}
          options={[
            { value: "waiting", label: "No issuer" },
            { value: "empty", label: "No cards" },
            { value: "one", label: "Owner's card" },
            { value: "team", label: "Team" },
            { value: "loading", label: "Loading" },
          ]}
        />
      </div>
      <CardsView
        business="Studio Kaze"
        sandbox
        issuer={state === "waiting" ? null : "bitnob"}
        cards={cards}
        purchases={state === "team" ? SAMPLE_CARDS.purchases : []}
        selectedId={selected}
        onSelect={setSelected}
        onNewCard={() => {
          setStep("form")
          setCreating(true)
        }}
        onLinked={() => undefined}
      />
      {selected && !money ? (
        <CardPanel
          card={card}
          business="Studio Kaze"
          sandbox
          purchases={SAMPLE_CARDS.purchases.filter((p) => p.cardId === selected)}
          moves={[]}
          busy={null}
          problem={null}
          onOpenChange={(o) => !o && setSelected(null)}
          onAddMoney={() => setMoney("in")}
          onMoveBack={() => setMoney("out")}
          onFreeze={() => undefined}
          onLimit={() => undefined}
          onRename={() => undefined}
          onRemove={() => setSelected(null)}
          onTestPurchase={() => undefined}
        />
      ) : null}
      <CardMoneySheet
        open={money !== null}
        onOpenChange={(o) => !o && setMoney(null)}
        direction={money ?? "in"}
        card={card}
        business="Studio Kaze"
        balance={482.5}
        busy={false}
        problem={null}
        onConfirm={() => setMoney(null)}
      />
      <NewCardSheet
        open={creating}
        onOpenChange={setCreating}
        business="Studio Kaze"
        people={SAMPLE_CARDS.people}
        cards={SAMPLE_CARDS.cards}
        balance={482.5}
        step={step}
        progress={progress}
        busy={false}
        problem={null}
        made={
          step === "done"
            ? { ...SAMPLE_CARDS.cards[1]!, id: "dev-new", nickname: "Events", last4: "5512" }
            : null
        }
        onCreate={() => {
          setStep("making")
          setProgress(1)
          setTimeout(() => setProgress(2), 900)
          setTimeout(() => setProgress(3), 1800)
          setTimeout(() => setStep("done"), 2400)
        }}
        onShowCard={() => setCreating(false)}
      />
    </div>
  )
}
