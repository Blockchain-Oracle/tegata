"use client"

// The Tegata seal (角印): 手 above 形 cut into a square company seal, the way a Japanese business signs a bill.
// Drawn from real glyph outlines (lib/brand/glyphs.ts) with an ink texture, so it reads as a stamp on paper.
// Also: the per-business round seal (丸印) whose ring carries the business name, and the press that lands it.
import { motion, useReducedMotion } from "motion/react"
import { useId } from "react"

import { GLYPH_BOX, SEAL_FACES, type SealFace } from "@/lib/brand/glyphs"
import { cn } from "@/lib/utils"

const VIEW = 200
type Box = readonly [number, number, number, number]

/** Fit a glyph's outline into a cell, centred, keeping its proportions. */
function fit(box: Box, x: number, y: number, w: number, h: number) {
  const [x1, y1, x2, y2] = box
  const bw = x2 - x1
  const bh = y2 - y1
  const s = Math.min(w / bw, h / bh)
  const tx = x + (w - bw * s) / 2 - x1 * s
  const ty = y + (h - bh * s) / 2 - y1 * s
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`
}

/** Ink texture: tiny specks knocked out of the fill and a slightly rough edge, like a real impression. */
function InkFilter({ id, roughness = 1 }: { id: string; roughness?: number }) {
  return (
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.62"
        numOctaves="2"
        seed="7"
        result="speck"
      />
      {/* Alpha = 13.2 − 17·noise: opaque almost everywhere, a rare speck where the noise peaks. */}
      <feColorMatrix
        in="speck"
        type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -17 13.2"
        result="holes"
      />
      <feComposite in="SourceGraphic" in2="holes" operator="in" result="specked" />
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.04"
        numOctaves="2"
        seed="3"
        result="warp"
      />
      <feDisplacementMap
        in="specked"
        in2="warp"
        scale={1.6 * roughness}
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  )
}

export type SealTone = "shu" | "paper" | "ink"

const TONES: Record<SealTone, { field: string; glyph: string }> = {
  /** Vermilion field, paper-white glyphs: the mark on light surfaces. */
  shu: { field: "var(--shu)", glyph: "#FFFFFF" },
  /** White field, vermilion glyphs: the mark on the vermilion stage. */
  paper: { field: "#FFFFFF", glyph: "var(--shu)" },
  /** Single colour, for print and the favicon in monochrome contexts. */
  ink: { field: "currentColor", glyph: "var(--background)" },
}

export function TegataSeal({
  size = 40,
  tone = "shu",
  face = "shippori",
  textured = true,
  tilt = 0,
  className,
  title = "Tegata",
}: {
  size?: number
  tone?: SealTone
  face?: SealFace
  textured?: boolean
  tilt?: number
  className?: string
  title?: string
}) {
  const id = useId().replace(/:/g, "")
  const { field, glyph } = TONES[tone]
  const glyphs = SEAL_FACES[face].glyphs
  // Two glyphs stacked in a column, inside an inner rule, like a square company seal.
  const pad = 30
  const cellH = (VIEW - pad * 2 - 6) / 2
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      <defs>
        {textured ? <InkFilter id={`ink-${id}`} roughness={size < 48 ? 0.4 : 1} /> : null}
      </defs>
      <g filter={textured ? `url(#ink-${id})` : undefined}>
        <rect x="6" y="6" width={VIEW - 12} height={VIEW - 12} rx="30" fill={field} />
        <rect
          x="18"
          y="18"
          width={VIEW - 36}
          height={VIEW - 36}
          rx="20"
          fill="none"
          stroke={glyph}
          strokeWidth="5"
        />
        <path
          d={glyphs.手.d}
          fill={glyph}
          transform={fit(glyphs.手.box, pad, pad - 2, VIEW - pad * 2, cellH)}
        />
        <path
          d={glyphs.形.d}
          fill={glyph}
          transform={fit(glyphs.形.box, pad, pad + cellH + 8, VIEW - pad * 2, cellH)}
        />
      </g>
    </svg>
  )
}

/** "Tegata" in the condensed display cut. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("display text-[26px] leading-none tracking-[-0.01em]", className)}>
      Tegata
    </span>
  )
}

export function Lockup({
  size = 32,
  tone = "shu",
  className,
}: {
  size?: number
  tone?: SealTone
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <TegataSeal size={size} tone={tone} />
      <Wordmark className={tone === "paper" ? "text-white" : undefined} />
    </span>
  )
}

/** Two to three letters for the centre of a business seal: "Abu Studio" → "AS", "Zainab & Co." → "ZC". */
export function monogramOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return "T"
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return words
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("")
}

/**
 * The business's own round seal: its name around the ring, a monogram in the centre, and an optional band
 * ("Paid · 12 Nov 2026"). Vermilion lines on paper (朱文), with the same ink texture as the Tegata mark.
 */
export function BusinessSeal({
  name,
  band,
  size = 120,
  tilt = -6,
  className,
}: {
  name: string
  band?: string
  size?: number
  tilt?: number
  className?: string
}) {
  const id = useId().replace(/:/g, "")
  const c = VIEW / 2
  const ringR = 72
  const ringText = `${name.trim() || "Your business"} · TEGATA ·`.toUpperCase()
  // Fill the ring evenly whatever the name's length.
  const circumference = 2 * Math.PI * ringR
  const monogram = monogramOf(name)
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={size}
      height={size}
      role="img"
      aria-label={`${name} seal`}
      className={cn("shrink-0", className)}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <defs>
        <InkFilter id={`ink-${id}`} roughness={size < 64 ? 0.5 : 1} />
        <path
          id={`ring-${id}`}
          d={`M ${c - ringR} ${c} a ${ringR} ${ringR} 0 1 1 ${ringR * 2} 0 a ${ringR} ${ringR} 0 1 1 ${-ringR * 2} 0`}
        />
      </defs>
      <g filter={`url(#ink-${id})`} fill="var(--shu)" stroke="var(--shu)">
        <circle cx={c} cy={c} r="94" fill="none" strokeWidth="7" />
        <circle cx={c} cy={c} r="56" fill="none" strokeWidth="3" />
        <text
          fontFamily="var(--font-archivo)"
          fontWeight={800}
          fontSize="17"
          letterSpacing="2"
          stroke="none"
          textLength={circumference - 6}
          lengthAdjust="spacingAndGlyphs"
        >
          <textPath href={`#ring-${id}`} startOffset="0">
            {ringText}
          </textPath>
        </text>
        {band ? (
          <>
            <rect x="34" y={c - 17} width="132" height="34" rx="4" stroke="none" />
            <text
              x={c}
              y={c + 7}
              textAnchor="middle"
              fontFamily="var(--font-archivo)"
              fontWeight={900}
              fontSize="19"
              letterSpacing="1"
              fill="#FFFFFF"
              stroke="none"
              style={{ fontVariationSettings: '"wdth" 62' }}
            >
              {band.toUpperCase()}
            </text>
          </>
        ) : (
          <text
            x={c}
            y={c + 19}
            textAnchor="middle"
            fontFamily="var(--font-archivo)"
            fontWeight={900}
            fontSize={monogram.length > 2 ? 44 : 56}
            stroke="none"
            style={{ fontVariationSettings: '"wdth" 62' }}
          >
            {monogram}
          </text>
        )}
      </g>
    </svg>
  )
}

/** Lands a seal once: in from above and slightly large, a firm press, then rest. Reduced motion: a short fade. */
export function SealPress({
  children,
  play = true,
  delay = 0,
  onLanded,
  className,
}: {
  children: React.ReactNode
  play?: boolean
  delay?: number
  onLanded?: () => void
  className?: string
}) {
  const reduce = useReducedMotion()
  if (!play) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.12, y: -8 }}
      animate={
        reduce ? { opacity: 1 } : { opacity: [0, 1, 1], scale: [1.12, 0.98, 1], y: [-8, 0, 0] }
      }
      transition={
        reduce ? { duration: 0.1, delay } : { duration: 0.22, times: [0, 0.55, 1], delay }
      }
      onAnimationComplete={onLanded}
    >
      {children}
    </motion.div>
  )
}

export { GLYPH_BOX }
