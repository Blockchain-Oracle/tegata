"use client"

import { Figure } from "@/components/kit/figure"
import { Stage } from "@/components/kit/stage"
import { cn } from "@/lib/utils"

import { Section, Specimen } from "../dev-chrome"

const CHROME = [
  ["background", "Page"],
  ["card", "Card"],
  ["secondary", "Plate, input"],
  ["plate-pressed", "Pressed"],
  ["foreground", "Ink"],
  ["muted-foreground", "Text 2"],
  ["text-3", "Text 3"],
  ["primary", "Main action"],
] as const

const BRAND = [
  ["shu", "Shu · seal, selected, focus", "#FF4F00"],
  ["shu-ink", "Shu ink · seal colour as text", ""],
  ["shu-wash", "Shu wash · selected row", ""],
] as const

const STORY = [
  ["matcha", "Matcha", "#C8F06A"],
  ["sora", "Sora", "#A9D8FF"],
  ["sakura", "Sakura", "#FFC2D6"],
  ["kin", "Kin", "#FFD23F"],
  ["ai", "Ai", "#1B1F5E"],
] as const

const STATE = [
  ["up", "Money in"],
  ["down", "Failed, money out of reach"],
  ["warn", "Warning"],
  ["up-surface", "Up surface"],
  ["down-surface", "Down surface"],
  ["warn-surface", "Warn surface"],
] as const

function Swatch({
  token,
  label,
  hex,
  dark,
}: {
  token: string
  label: string
  hex?: string
  dark?: boolean
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[16px] bg-card">
      <div className="h-20" style={{ background: `var(--${token})` }} />
      <div className="flex flex-col gap-0.5 p-3">
        <span className="text-[14px] font-semibold">{label}</span>
        <span className={cn("font-mono text-meta text-muted-foreground", dark && "text-white/70")}>
          --{token}
          {hex ? ` · ${hex}` : ""}
        </span>
      </div>
    </div>
  )
}

const TYPE_ROLES = [
  { role: "display-hero 64", cls: "figure text-[64px]", sample: "$12,480.00" },
  { role: "display-balance 52", cls: "figure text-display-balance", sample: "$1,250.00" },
  { role: "display-price 40", cls: "figure text-display-price", sample: "$480.00" },
  { role: "page-title 32", cls: "display text-page-title", sample: "Pay people" },
  {
    role: "step-title 28 / 600",
    cls: "text-step-title font-semibold",
    sample: "What's your business called?",
  },
  { role: "sheet-title 24 / 600", cls: "text-sheet-title font-semibold", sample: "Review the run" },
  { role: "section-title 20 / 600", cls: "text-section-title font-semibold", sample: "Latest" },
  { role: "button, row title 17 / 600", cls: "text-button font-semibold", sample: "Send invoice" },
  { role: "row 16 / 500", cls: "text-row font-medium", sample: "Paid from Base" },
  {
    role: "detail 14",
    cls: "text-detail text-muted-foreground",
    sample: "Invoice 0042 · due 14 Dec",
  },
  { role: "meta 12", cls: "text-meta text-muted-foreground", sample: "2 min ago" },
  { role: "mono 15", cls: "font-mono text-[15px]", sample: "abu-studio.tegata.near" },
] as const

export default function ColorPage() {
  return (
    <div className="flex flex-col">
      <Section
        title="The stage"
        note="A lit vermilion field where real product objects float. It carries the moments that matter: sign-in, onboarding, the landing hero, the balance, the pay page header. It stays lit in dark mode."
      >
        <Stage className="min-h-64 p-10" inner="grid min-h-44 place-items-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-[15px] font-medium text-white/85">Balance · USDC on NEAR</span>
            <Figure value={12480} className="text-[72px] text-white" />
          </div>
        </Stage>
      </Section>

      <Section
        title="Story fields"
        note="Whole scenes of colour for onboarding, empty states, the landing story cards and Home's first steps. Text on them is ink (white on Ai)."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {STORY.map(([token, label, hex]) => (
            <div
              key={token}
              className={cn(
                "flex h-40 flex-col justify-between rounded-[20px] p-4",
                token === "ai" ? "text-white" : "text-black",
              )}
              style={{ background: `var(--${token})` }}
            >
              <span className="display text-[28px] leading-none">{label}</span>
              <span className="font-mono text-meta opacity-70">{hex}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Brand">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {BRAND.map(([token, label, hex]) => (
            <Swatch key={token} token={token} label={label} hex={hex} />
          ))}
        </div>
      </Section>

      <Section
        title="Chrome"
        note="Quiet plates for the work. Depth is one step lighter, never a border or a shadow."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CHROME.map(([token, label]) => (
            <Swatch key={token} token={token} label={label} />
          ))}
        </div>
      </Section>

      <Section title="Direction and state" note="Always with a sign or a word, never colour alone.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STATE.map(([token, label]) => (
            <Swatch key={token} token={token} label={label} />
          ))}
        </div>
      </Section>

      <Section
        title="Type"
        note="Archivo for everything: width 62 at 900 for money and titles, width 100 for the interface. DM Mono for addresses and codes."
      >
        <Specimen label="Roles">
          <div className="flex flex-col divide-y divide-secondary">
            {TYPE_ROLES.map((r) => (
              <div
                key={r.role}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <span className="w-56 shrink-0 font-mono text-meta text-text-3">{r.role}</span>
                <span className={cn("leading-tight", r.cls)}>{r.sample}</span>
              </div>
            ))}
          </div>
        </Specimen>
      </Section>
    </div>
  )
}
