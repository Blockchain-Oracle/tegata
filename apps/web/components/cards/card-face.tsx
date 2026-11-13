"use client"

// Tegata's card face (plan 6.8 AD, context/09-realworld-money/cards-ux-brief.md §3). A pocket stage: one flat field
// colour with the stage's grain and one soft light, and four things at rest: the business's own seal with the card's
// nickname, "Virtual", the holder with the last four, and the real Visa mark. The owner's cards are ink; each person
// keeps one story colour everywhere. Frozen frosts over (no glass, no blur); a card being made shimmers once.
import { Snowflake } from "lucide-react"

import { BusinessSeal } from "@/components/brand/seal"
import { GRAIN } from "@/components/kit/stage"
import { cn } from "@/lib/utils"

export type CardTone = "ink" | "matcha" | "sora" | "sakura" | "kin" | "ai"
export type CardState = "active" | "making" | "frozen" | "removed" | "linked"
export type CardSize = "thumb" | "md" | "lg" | "hero"

/** People take these in order; the owner is always ink. */
export const PERSON_TONES: readonly CardTone[] = ["matcha", "sora", "sakura", "kin", "ai"]

const FIELD: Record<CardTone, { base: string; light: string; dark: boolean }> = {
  ink: { base: "#0B0B0B", light: "#2B2B2B", dark: true },
  matcha: { base: "#C8F06A", light: "#E2FF9E", dark: false },
  sora: { base: "#A9D8FF", light: "#D4ECFF", dark: false },
  sakura: { base: "#FFC2D6", light: "#FFE0EA", dark: false },
  kin: { base: "#FFD23F", light: "#FFF1A8", dark: false },
  ai: { base: "#1B1F5E", light: "#343A8F", dark: true },
}

const WIDTH: Record<CardSize, string> = {
  thumb: "w-[56px] rounded-[8px]",
  md: "w-full max-w-[320px] rounded-[16px]",
  lg: "w-full max-w-[380px] rounded-[16px]",
  hero: "w-full max-w-[420px] rounded-[20px]",
}

/** A light frost, finer than the stage grain, for a frozen card. */
const FROST =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.9 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E\")"

export function CardFace({
  tone,
  business,
  nickname,
  holder,
  last4,
  state = "active",
  frozenBy,
  issuer,
  size = "md",
  className,
}: {
  tone: CardTone
  /** The business whose round seal is on every card it issues. */
  business: string
  nickname: string
  holder: string
  /** Null while the card is being made. */
  last4: string | null
  state?: CardState
  /** On the holder's side, who froze it ("Frozen by Abu"). */
  frozenBy?: string | null
  /** A linked card: the issuer's name in place of "Virtual". */
  issuer?: string
  size?: CardSize
  className?: string
}) {
  const field = FIELD[tone]
  const text = field.dark ? "text-white" : "text-black"
  const sub = field.dark ? "text-white/70" : "text-black/60"
  const frozen = state === "frozen"
  const thumb = size === "thumb"
  return (
    <div
      className={cn(
        "relative isolate aspect-[1.586] shrink-0 overflow-hidden",
        WIDTH[size],
        state === "removed" && "opacity-45 grayscale",
        frozen && "saturate-[0.25]",
        className,
      )}
      style={{
        backgroundColor: field.base,
        backgroundImage: `radial-gradient(110% 90% at 8% 0%, ${field.light} 0%, ${field.base} 62%)`,
      }}
      role="img"
      aria-label={`${nickname}, ${holder}${last4 ? `, card ending ${last4}` : ""}${frozen ? ", frozen" : ""}`}
    >
      {/* The stage's grain, so the card reads as the same material as the stage. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
      {thumb ? (
        <span className="absolute top-1.5 left-1.5">
          <BusinessSeal name={business} size={14} tilt={0} />
        </span>
      ) : (
        <>
          {/* The seal again, three times larger, bleeding off the right edge at 5%. */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 -right-[22%] -translate-y-1/2 opacity-[0.06]"
          >
            <BusinessSeal name={business} size={size === "hero" ? 300 : 240} tilt={-8} />
          </span>
          <div className={cn("relative flex h-full flex-col justify-between p-[6%]", text)}>
            <div className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                {state === "linked" ? null : (
                  <BusinessSeal name={business} size={size === "hero" ? 32 : 28} tilt={0} />
                )}
                <span className="truncate text-[15px] leading-5 font-semibold">{nickname}</span>
              </span>
              <span className={cn("shrink-0 text-[12px] leading-4 font-medium", sub)}>
                {state === "linked" ? `Linked · ${issuer ?? "card"}` : "Virtual"}
              </span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13px] leading-4 font-semibold">{holder}</span>
                {state === "linked" ? null : frozen ? (
                  <span className="inline-flex items-center gap-1 text-[14px] font-semibold">
                    <Snowflake className="size-3.5" />{" "}
                    {frozenBy ? `Frozen by ${frozenBy}` : "Frozen"}
                  </span>
                ) : (
                  <span className="tnum font-mono text-[15px] tracking-[0.06em]">
                    •• {last4 ?? "••••"}
                  </span>
                )}
              </span>
              <img
                src={field.dark ? "/marks/visa-white.svg" : "/marks/visa.svg"}
                alt="Visa"
                className="h-[15px] w-auto shrink-0"
                draggable={false}
              />
            </div>
          </div>
        </>
      )}
      {frozen ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-white/55"
          style={{
            backgroundImage: FROST,
            maskImage: "radial-gradient(130% 120% at 50% 50%, transparent 30%, black 85%)",
            WebkitMaskImage: "radial-gradient(130% 120% at 50% 50%, transparent 30%, black 85%)",
          }}
        />
      ) : null}
      {state === "making" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 animate-[card-shimmer_1.6s_ease-in-out_1] bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />
      ) : null}
    </div>
  )
}
