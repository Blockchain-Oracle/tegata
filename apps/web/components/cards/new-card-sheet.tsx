"use client"

// Create a card (cards-ux-brief §4.3, Mercury's create drawer): who it's for, its name, a monthly limit (or none) and
// what to start it with, with the face updating live at the top. One hold approves the first fill; then the steps run
// (approved, on NEAR, the issuer makes the card) and the seal presses onto the new face.
import { Check, KeyRound } from "lucide-react"
import { useEffect, useState } from "react"
import { BusinessSeal, SealPress } from "@/components/brand/seal"
import { CustomerDisc } from "@/components/invoices/customer-picker"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { HoldButton } from "@/components/kit/hold-button"
import { Stage } from "@/components/kit/stage"
import { Switch } from "@/components/kit/switch"
import { TaskSteps } from "@/components/kit/task-steps"
import { Sheet } from "@/components/shell/sheet"
import type { CardToneName, IssuedCardView } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { usd } from "@/lib/fiat"
import { cn } from "@/lib/utils"

import { CardFace, PERSON_TONES } from "./card-face"

export type NewCardStep = "form" | "making" | "done"

export interface NewCardInput {
  personId: string | null
  nickname: string
  startWith: string
  monthlyLimit: string | null
}

export function NewCardSheet({
  open,
  onOpenChange,
  business,
  people,
  cards,
  balance,
  step,
  progress,
  busy,
  problem,
  made,
  onCreate,
  onShowCard,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  business: string
  people: { id: string; name: string; email: string | null }[]
  /** The cards so far: a person keeps their colour, a new person takes the next one. */
  cards: IssuedCardView[]
  /** Dollars in the balance. */
  balance: number
  step: NewCardStep
  progress: number
  busy: boolean
  problem: string | null
  made: IssuedCardView | null
  onCreate: (input: NewCardInput) => void
  onShowCard: (id: string) => void
}) {
  const [personId, setPersonId] = useState<string | null>(null)
  const [nickname, setNickname] = useState("")
  const [startWith, setStartWith] = useState("20")
  const [noLimit, setNoLimit] = useState(true)
  const [limit, setLimit] = useState("500")
  useEffect(() => {
    if (!open) return
    setPersonId(null)
    setNickname("")
    setStartWith("20")
    setNoLimit(true)
    setLimit("500")
  }, [open])

  const person = people.find((x) => x.id === personId)
  const holder = person?.name ?? business
  const tone: CardToneName = (() => {
    if (!personId) return "ink"
    const own = cards.find((c) => c.personId === personId)
    if (own) return own.tone
    const seen = new Set(cards.filter((c) => c.personId).map((c) => c.personId))
    return PERSON_TONES[seen.size % PERSON_TONES.length] ?? "matcha"
  })()
  const start = Number.parseFloat(startWith || "0") || 0
  const over = start > balance
  const ready =
    start >= 2 && !over && (noLimit || Number(limit) > 0) && (!person || Boolean(person.email))

  const steps = [
    { id: "sign", label: "Approved", detail: "with your key", icon: <KeyRound /> },
    {
      id: "near",
      label: `${usd(start)} to the card`,
      detail: "on NEAR, fee paid by Tegata",
      mark: "near" as const,
    },
    { id: "issue", label: "Making the card", detail: "Visa, by Bitnob", icon: <Check /> },
  ]

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={step === "done" ? "Your card is ready" : "New card"}
    >
      <div className="flex flex-col gap-5">
        <Stage className="px-4 py-6" inner="relative flex justify-center">
          <CardFace
            tone={made?.tone ?? tone}
            business={business}
            nickname={made?.nickname ?? (nickname.trim() || "Card")}
            holder={made?.holderName ?? holder}
            last4={made?.last4 ?? null}
            state={step === "making" ? "making" : "active"}
            size="md"
            className="shadow-object"
          />
          {step === "done" ? (
            <span className="absolute -top-2 right-2">
              <SealPress
                delay={0.2}
                onLanded={() => fire("filled", { cue: "stamp", identity: made?.id })}
              >
                <BusinessSeal name={business} band="Issued" size={84} />
              </SealPress>
            </span>
          ) : null}
        </Stage>

        {step === "form" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
            }}
          >
            <div className="flex flex-col gap-2">
              <span className="text-detail font-medium text-muted-foreground">For</span>
              <div className="flex flex-wrap gap-2">
                {[{ id: null, name: "You", email: "you" }, ...people].map((x) => {
                  const chosen = personId === x.id
                  const noEmail = x.id !== null && !x.email
                  return (
                    <button
                      key={x.id ?? "you"}
                      type="button"
                      disabled={noEmail}
                      onClick={() => setPersonId(x.id)}
                      title={noEmail ? `Add ${x.name}'s email first` : undefined}
                      className={cn(
                        "press inline-flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-[14px] font-semibold",
                        chosen ? "bg-foreground text-background" : "bg-secondary",
                        noEmail && "opacity-50",
                      )}
                    >
                      {x.id === null ? (
                        <BusinessSeal name={business} size={24} tilt={0} />
                      ) : (
                        <CustomerDisc name={x.name} size={24} />
                      )}
                      {x.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <Field
              id="card-nickname"
              label="Card name"
              placeholder="Ads, Travel, Supplies…"
              maxLength={24}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <Field
              id="card-start"
              label="Start with"
              inputMode="decimal"
              value={startWith}
              onChange={(e) => setStartWith(e.target.value.replace(/[^0-9.]/g, ""))}
              leading={<span className="text-[17px] font-semibold text-text-3">$</span>}
              status={
                over
                  ? { kind: "bad", text: `You have ${usd(balance)}` }
                  : start > 0 && start < 2
                    ? { kind: "bad", text: "At least $2.00" }
                    : { kind: "none" }
              }
            />
            <div className="flex flex-col gap-3 rounded-[16px] bg-secondary p-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold">Monthly limit</span>
                <span className="flex items-center gap-2 text-[14px] text-muted-foreground">
                  No limit
                  <Switch checked={noLimit} onCheckedChange={setNoLimit} label="No limit" />
                </span>
              </div>
              {noLimit ? null : (
                <Field
                  id="card-limit-new"
                  aria-label="Monthly limit"
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))}
                  leading={<span className="text-[17px] font-semibold text-text-3">$</span>}
                />
              )}
            </div>
            {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
            <HoldButton
              label={`Hold to create and add ${usd(start)}`}
              ready={ready}
              busy={busy}
              onConfirm={() =>
                onCreate({
                  personId,
                  nickname: nickname.trim() || "Card",
                  startWith,
                  monthlyLimit: noLimit ? null : limit,
                })
              }
            />
          </form>
        ) : step === "making" ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-[20px] bg-secondary p-2">
              <TaskSteps steps={steps} current={progress} />
            </div>
            {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Done
            </Button>
            <Button onClick={() => made && onShowCard(made.id)}>View card</Button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
