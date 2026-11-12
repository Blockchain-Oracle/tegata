"use client"

// New pay link (plan 6.8 G): what it's for, an amount or "any amount", an optional note. The card at the top is the
// pay page's own card, filling in as you type (Bento and Cosmos: the object reacts to the form).
import { useState } from "react"

import { BusinessSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure } from "@/components/kit/figure"
import { Paper, Stage } from "@/components/kit/stage"
import { Switch } from "@/components/kit/switch"
import { MarkStack } from "@/components/marks/mark"
import { Sheet } from "@/components/shell/sheet"

const TITLE_MAX = 80
const NOTE_MAX = 280

export interface NewLinkInput {
  title: string
  /** Dollars as typed; undefined for an any-amount link. */
  amount?: string
  note?: string
}

export function NewLinkSheet({
  open,
  onOpenChange,
  businessName,
  creating,
  problem,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessName: string
  creating: boolean
  problem: string | null
  onCreate: (input: NewLinkInput) => void
}) {
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [anyAmount, setAnyAmount] = useState(false)
  const [note, setNote] = useState("")
  const value = Number.parseFloat(amount || "0") || 0
  const ready = title.trim().length > 0 && (anyAmount || value > 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="New pay link">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!ready || creating) return
          onCreate({
            title: title.trim(),
            amount: anyAmount ? undefined : amount,
            note: note.trim() || undefined,
          })
        }}
      >
        <Stage className="p-4" grid={false}>
          <Paper className="relative p-5">
            <span className="text-[13px] font-semibold text-[#666]">Pay {businessName}</span>
            <span className="mt-1 block truncate text-[17px] font-semibold">
              {title.trim() || "What it's for"}
            </span>
            {anyAmount ? (
              <span className="display mt-1 block text-[40px] leading-none">Any amount</span>
            ) : (
              <Figure value={value} className="mt-1 text-[48px]" />
            )}
            <span className="mt-3 flex items-center gap-2 text-[13px] text-[#666]">
              <MarkStack ids={["usdc", "near"]} size={18} /> USDC on NEAR
            </span>
            <div className="absolute -top-4 -right-3">
              <BusinessSeal name={businessName} size={64} />
            </div>
          </Paper>
        </Stage>

        <Field
          id="link-title"
          label="What it's for"
          placeholder="Logo design, March retainer…"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div className="flex flex-col gap-3">
          <Field
            id="link-amount"
            label="Amount"
            inputMode="decimal"
            placeholder="0.00"
            disabled={anyAmount}
            value={anyAmount ? "" : amount}
            onChange={(e) =>
              setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
            }
            leading={<span className="figure text-[22px] text-muted-foreground">$</span>}
            className="tnum"
          />
          <div className="flex items-center justify-between gap-4 rounded-[14px] bg-secondary px-4 py-3">
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">Any amount</span>
              <span className="text-detail text-muted-foreground">
                The payer types what they owe
              </span>
            </span>
            <Switch checked={anyAmount} onCheckedChange={setAnyAmount} label="Any amount" />
          </div>
        </div>

        <Field
          id="link-note"
          label="Note for the payer (optional)"
          placeholder="Thanks for your business"
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
        />

        {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
        <Button type="submit" busy={creating} disabled={!ready} cue="tap">
          Create pay link
        </Button>
      </form>
    </Sheet>
  )
}
