"use client"

// Business profile (plan 6.8 I): on the stage, the header every receipt and invoice will carry, filling in as you
// type, with the round seal beside it (it follows the name); beside it, one card of fields. Save appears only when
// something changed. Separate from its logic so /dev/flows can show every state.
import { Check, Copy, ImagePlus, Trash2 } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { BusinessSeal, SealPress } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Field, type FieldStatus } from "@/components/kit/field"
import { Paper, Stage } from "@/components/kit/stage"
import { Mark } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

const LOGO_EDGE = 256
const LOGO_QUALITY = 0.9
const COPIED_MS = 1500

export type BusinessFieldName = "name" | "address" | "taxId" | "email" | "timezone" | "logo"

export interface BusinessDraft {
  name: string
  address: string
  taxId: string
  email: string
  timezone: string
  /** A logo URL or data URL; null for none. */
  logo: string | null
}

export interface BusinessViewProps {
  initial: BusinessDraft
  accountId: string
  signInEmail: string | null
  saving: boolean
  problem: { field: BusinessFieldName | null; message: string } | null
  onSave: (draft: BusinessDraft, logoChanged: boolean) => void
}

/** Any picked image becomes a small square WebP, so a large logo still fits the 200 KB limit. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, LOGO_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/webp", LOGO_QUALITY)
}

function zones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone")
  } catch {
    return ["UTC"]
  }
}

export function BusinessView(p: BusinessViewProps) {
  const [draft, setDraft] = useState(p.initial)
  const [logoChanged, setLogoChanged] = useState(false)
  const [logoProblem, setLogoProblem] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pressKey, setPressKey] = useState(0)
  const file = useRef<HTMLInputElement>(null)
  const timezones = useMemo(() => {
    const all = zones()
    return all.includes(draft.timezone) ? all : [draft.timezone, ...all]
  }, [draft.timezone])

  const dirty =
    logoChanged ||
    (["name", "address", "taxId", "email", "timezone"] as const).some(
      (key) => draft[key].trim() !== p.initial[key].trim(),
    )
  const set = (key: keyof BusinessDraft) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }))
  const status = (field: BusinessFieldName): FieldStatus =>
    p.problem?.field === field ? { kind: "bad", text: p.problem.message } : { kind: "none" }

  const pick = async (picked: File | undefined) => {
    if (!picked) return
    setLogoProblem(null)
    try {
      setDraft((d) => ({ ...d, logo: null }))
      const logo = await shrink(picked)
      setDraft((d) => ({ ...d, logo }))
      setLogoChanged(true)
    } catch {
      setLogoProblem("That file isn't an image we can read. Try a PNG or JPEG.")
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(p.accountId)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="display text-page-title">Business</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <Stage className="p-5 sm:p-7 lg:sticky lg:top-6">
          <Paper className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              {draft.logo ? (
                <img
                  src={draft.logo}
                  alt=""
                  className="size-14 shrink-0 rounded-[14px] object-cover"
                />
              ) : (
                <BusinessSeal name={draft.name} size={56} tilt={0} />
              )}
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[18px] font-semibold">
                  {draft.name.trim() || "Your business"}
                </span>
                {draft.address.trim() ? (
                  <span className="whitespace-pre-line text-[13px] text-[#666]">
                    {draft.address.trim()}
                  </span>
                ) : (
                  <span className="text-[13px] text-[#999]">Address</span>
                )}
                {draft.taxId.trim() ? (
                  <span className="text-[13px] text-[#666]">Tax ID {draft.taxId.trim()}</span>
                ) : null}
                {draft.email.trim() ? (
                  <span className="text-[13px] text-[#666]">{draft.email.trim()}</span>
                ) : null}
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t-2 border-dashed border-[#ECECEC] pt-4 text-[13px] text-[#666]">
              <span>Receipt · No. 0001</span>
              <span className="inline-flex items-center gap-1.5">
                <Mark id="near" size={14} /> {p.accountId}
              </span>
            </div>
          </Paper>
          <div className="mt-6 flex items-center gap-4">
            <span className="grid size-[108px] shrink-0 place-items-center rounded-full bg-white shadow-object">
              <SealPress
                key={pressKey}
                play={pressKey > 0}
                onLanded={() => fire("filled", { cue: "stamp" })}
              >
                <BusinessSeal name={draft.name} size={96} />
              </SealPress>
            </span>
            <p className="text-[15px] font-medium text-white">
              Your seal follows your name. It stamps every receipt and invoice.
            </p>
          </div>
        </Stage>

        <form
          className="flex flex-col gap-5 rounded-[24px] bg-card p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (!dirty || p.saving) return
            if (draft.name.trim() !== p.initial.name.trim()) setPressKey((n) => n + 1)
            p.onSave(draft, logoChanged)
            setLogoChanged(false)
          }}
        >
          <Field
            id="business-name"
            label="Business name"
            value={draft.name}
            maxLength={60}
            onChange={(e) => set("name")(e.target.value)}
            status={status("name")}
          />

          <div className="flex flex-col gap-2">
            <span className="text-detail font-medium text-muted-foreground">Logo</span>
            <div className="flex items-center gap-3">
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-input">
                {draft.logo ? (
                  <img src={draft.logo} alt="Your logo" className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-5 text-text-3" />
                )}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => file.current?.click()}
              >
                {draft.logo ? "Change" : "Upload logo"}
              </Button>
              {draft.logo ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft((d) => ({ ...d, logo: null }))
                    setLogoChanged(true)
                  }}
                >
                  <Trash2 /> Remove
                </Button>
              ) : null}
              <input
                ref={file}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  void pick(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
            </div>
            {logoProblem || p.problem?.field === "logo" ? (
              <span className="text-detail font-medium text-down">
                {logoProblem ?? p.problem?.message}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="business-address"
              className="text-detail font-medium text-muted-foreground"
            >
              Address
            </label>
            <textarea
              id="business-address"
              rows={3}
              maxLength={300}
              value={draft.address}
              placeholder={"12 Market Street\nLagos 100001\nNigeria"}
              onChange={(e) => set("address")(e.target.value)}
              className={cn(
                "w-full resize-none rounded-[14px] bg-input px-4 py-3.5 text-[17px] font-medium outline-none transition-[box-shadow,background-color] duration-150 placeholder:text-text-3 focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]",
                p.problem?.field === "address" && "shadow-[0_0_0_2px_var(--down)]",
              )}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="business-tax"
              label="Tax ID (optional)"
              placeholder="VAT, EIN, GST…"
              value={draft.taxId}
              maxLength={40}
              onChange={(e) => set("taxId")(e.target.value)}
              status={status("taxId")}
            />
            <Field
              id="business-email"
              label="Billing email (optional)"
              type="email"
              placeholder="accounts@studio.com"
              value={draft.email}
              maxLength={120}
              onChange={(e) => set("email")(e.target.value)}
              status={status("email")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="business-timezone"
              className="text-detail font-medium text-muted-foreground"
            >
              Time zone
            </label>
            <select
              id="business-timezone"
              value={draft.timezone}
              onChange={(e) => set("timezone")(e.target.value)}
              className="h-14 w-full rounded-[14px] bg-input px-4 text-[17px] font-medium outline-none focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]"
            >
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <span className="text-detail text-muted-foreground">
              Due dates and payroll run on this clock.
            </span>
          </div>

          <div className="flex flex-col divide-y divide-secondary rounded-[16px] bg-secondary/60 px-4">
            <div className="flex items-center justify-between gap-3 py-3">
              <span className="flex min-w-0 flex-col">
                <span className="text-detail text-muted-foreground">Pay address</span>
                <span className="truncate font-mono text-[15px] font-medium">{p.accountId}</span>
              </span>
              <button
                type="button"
                onClick={copy}
                className="press grid size-9 shrink-0 place-items-center rounded-full bg-card"
                aria-label="Copy pay address"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </div>
            {p.signInEmail ? (
              <div className="flex flex-col py-3">
                <span className="text-detail text-muted-foreground">Signed in as</span>
                <span className="truncate text-[15px] font-medium">{p.signInEmail}</span>
              </div>
            ) : null}
          </div>

          {p.problem && p.problem.field === null ? (
            <p className="text-[15px] font-medium text-down">{p.problem.message}</p>
          ) : null}
          <Button type="submit" busy={p.saving} disabled={!dirty} cue={dirty ? "tap" : undefined}>
            {dirty ? "Save changes" : "Saved"}
          </Button>
        </form>
      </div>
    </div>
  )
}
