"use client"

import { RotateCw } from "lucide-react"
import { useState } from "react"

import { BusinessSeal, Lockup, SealPress, TegataSeal, Wordmark } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Stage } from "@/components/kit/stage"
import { Switch } from "@/components/kit/switch"
import { fire } from "@/lib/feedback"

import { Section, Specimen } from "../dev-chrome"

const SIZES = [16, 20, 24, 32, 48, 64, 96] as const

export default function BrandPage() {
  const [name, setName] = useState("Abu Studio")
  const [band, setBand] = useState(true)
  const [pressKey, setPressKey] = useState(0)
  const replay = () => setPressKey((k) => k + 1)

  return (
    <div className="flex flex-col">
      <Section
        title="The mark"
        note="手形 (tegata, a bill of exchange) cut into a square company seal. A Japanese business signs with its seal, not a pen. Real glyph outlines, ink texture, no font shipped."
      >
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Stage className="min-h-[380px] p-10" inner="grid min-h-[300px] place-items-center">
            <div className="flex flex-col items-center gap-6">
              <SealPress
                key={`hero-${pressKey}`}
                onLanded={() => pressKey > 0 && fire("confirm", { cue: "stamp" })}
              >
                <TegataSeal size={200} tone="paper" tilt={-4} />
              </SealPress>
              <Wordmark className="text-[64px] text-white" />
            </div>
          </Stage>
          <div className="grid gap-4">
            <Specimen label="Shippori Mincho B1 800 (chosen)">
              <div className="flex items-center gap-5">
                <TegataSeal size={120} face="shippori" />
                <TegataSeal size={120} face="shippori" tone="ink" className="text-foreground" />
              </div>
            </Specimen>
            <Specimen label="Noto Serif JP 900 (alternative)">
              <div className="flex items-center gap-5">
                <TegataSeal size={120} face="notoSerif" />
                <TegataSeal size={120} face="notoSerif" tone="ink" className="text-foreground" />
              </div>
            </Specimen>
          </div>
        </div>
        <Button variant="secondary" size="md" className="self-start" onClick={replay}>
          <RotateCw /> Press the seal again
        </Button>
      </Section>

      <Section
        title="Sizes"
        note="From the browser tab up. Under 48 px the texture eases off so the glyphs stay legible."
      >
        <Specimen label="Seal at each size">
          <div className="flex flex-wrap items-end gap-6">
            {SIZES.map((s) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <TegataSeal size={s} />
                <span className="tnum text-meta text-text-3">{s}</span>
              </div>
            ))}
          </div>
        </Specimen>
      </Section>

      <Section title="Lockups">
        <div className="grid gap-4 md:grid-cols-3">
          <Specimen label="On a plate">
            <div className="grid h-28 place-items-center rounded-[14px] bg-background">
              <Lockup size={40} />
            </div>
          </Specimen>
          <Specimen label="On the stage">
            <Stage className="h-28" inner="grid place-items-center" grid={false}>
              <Lockup size={40} tone="paper" />
            </Stage>
          </Specimen>
          <Specimen label="App icon">
            <div className="flex h-28 items-center justify-center gap-4">
              <div className="grid size-24 place-items-center rounded-[26px] bg-white shadow-object">
                <TegataSeal size={72} />
              </div>
              <Stage
                className="size-24 rounded-[26px]"
                inner="grid place-items-center"
                grid={false}
                rounded={false}
              >
                <TegataSeal size={72} tone="paper" />
              </Stage>
            </div>
          </Specimen>
        </div>
      </Section>

      <Section
        title="Every business gets its own seal"
        note="Cut from the business name the moment the account opens: the name runs round the ring, a monogram sits in the centre. The same seal stamps every paid invoice, receipt and payslip."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col gap-4 rounded-[20px] bg-card p-5">
            <Field
              label="Business name"
              id="seal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
            <div className="flex items-center justify-between rounded-[14px] bg-secondary px-4 py-3">
              <span className="text-[16px] font-medium">"Paid" band</span>
              <Switch checked={band} onCheckedChange={setBand} label="Show the paid band" />
            </div>
            <Button size="lg" variant="primary" cue="tap" onClick={replay}>
              Stamp it
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid min-h-64 place-items-center rounded-[20px] bg-card">
              <SealPress
                key={`biz-${pressKey}`}
                onLanded={() => pressKey > 0 && fire("confirm", { cue: "stamp" })}
              >
                <BusinessSeal name={name} size={200} band={band ? "Paid · 12 Nov" : undefined} />
              </SealPress>
            </div>
            <div className="grid min-h-64 place-items-center rounded-[20px] bg-white">
              <div className="relative w-56 rounded-[12px] bg-white p-4 text-black shadow-receipt">
                <p className="text-meta font-semibold text-[#666]">Invoice 0042</p>
                <p className="figure mt-1 text-[40px]">$1,250.00</p>
                <p className="text-[13px] text-[#666]">{name || "Your business"}</p>
                <div className="absolute -right-6 -bottom-6">
                  <SealPress key={`inv-${pressKey}`} delay={0.15}>
                    <BusinessSeal name={name} size={104} band="Paid" />
                  </SealPress>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Share image"
        note="What a link to Tegata shows when it is pasted into a chat."
      >
        <Stage className="aspect-[1200/630] w-full max-w-3xl p-10 sm:p-14" rounded>
          <div className="flex h-full flex-col justify-between">
            <Lockup size={52} tone="paper" />
            <p className="display max-w-xl text-[44px] leading-[0.95] sm:text-[64px]">
              Get paid. Pay your team. In exact dollars.
            </p>
            <p className="text-[18px] text-white/85">
              Invoices, pay links and payroll, settled in USDC on NEAR.
            </p>
          </div>
        </Stage>
      </Section>
    </div>
  )
}
