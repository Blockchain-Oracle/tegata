// The Tegata seal (角印, 手 above 形 in a square company seal) and the business's own round seal (丸印: its name round
// the ring, a monogram or a band like "PAID · 13 NOV 2026" in the centre), drawn with react-native-svg from the same
// glyph outlines as the web. The web's SVG ink filter has no native twin, so the ink is a fixed field of tiny specks
// knocked out of the fill, seeded from the name, so each seal is always the same impression.
import { useId, useMemo } from "react"
import Svg, { Circle, Defs, G, Path, Rect, Text as SvgText, TextPath } from "react-native-svg"

import { SEAL_FACES } from "@/brand/glyphs"
import { FONT, PAPER, SHU } from "@/theme/tokens"

const VIEW = 200
type Box = readonly [number, number, number, number]

function fit(box: Box, x: number, y: number, w: number, h: number) {
  const [x1, y1, x2, y2] = box
  const s = Math.min(w / (x2 - x1), h / (y2 - y1))
  const tx = x + (w - (x2 - x1) * s) / 2 - x1 * s
  const ty = y + (h - (y2 - y1) * s) / 2 - y1 * s
  return { tx, ty, s }
}

/** A small deterministic PRNG (mulberry32) so a seal's specks never move between renders. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hash = (text: string) =>
  [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)

function useSpecks(seed: string, count: number, inside: (x: number, y: number) => boolean) {
  return useMemo(() => {
    const rand = seeded(hash(seed))
    const specks: { x: number; y: number; r: number }[] = []
    let guard = 0
    while (specks.length < count && guard++ < count * 6) {
      const x = 10 + rand() * 180
      const y = 10 + rand() * 180
      if (inside(x, y)) specks.push({ x, y, r: 0.6 + rand() * 1.5 })
    }
    return specks
    // `inside` is a pure shape test for this seal kind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, count])
}

export type SealTone = "shu" | "paper" | "ink"

const TONES: Record<SealTone, { field: string; glyph: string }> = {
  shu: { field: SHU, glyph: PAPER.face },
  paper: { field: PAPER.face, glyph: SHU },
  ink: { field: PAPER.ink, glyph: PAPER.face },
}

export function TegataSeal({
  size = 40,
  tone = "shu",
  tilt = 0,
}: {
  size?: number
  tone?: SealTone
  tilt?: number
}) {
  const { field, glyph } = TONES[tone]
  const glyphs = SEAL_FACES.shippori.glyphs
  const pad = 30
  const cellH = (VIEW - pad * 2 - 6) / 2
  const top = fit(glyphs.手.box, pad, pad - 2, VIEW - pad * 2, cellH)
  const bottom = fit(glyphs.形.box, pad, pad + cellH + 8, VIEW - pad * 2, cellH)
  const specks = useSpecks(
    `tegata-${tone}`,
    size < 48 ? 0 : 46,
    (x, y) => x > 8 && x < 192 && y > 8 && y < 192,
  )
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      accessibilityLabel="Tegata"
      style={tilt ? { transform: [{ rotate: `${tilt}deg` }] } : undefined}
    >
      <Rect x={6} y={6} width={VIEW - 12} height={VIEW - 12} rx={30} fill={field} />
      <Rect
        x={18}
        y={18}
        width={VIEW - 36}
        height={VIEW - 36}
        rx={20}
        fill="none"
        stroke={glyph}
        strokeWidth={5}
      />
      <Path
        d={glyphs.手.d}
        fill={glyph}
        transform={`translate(${top.tx} ${top.ty}) scale(${top.s})`}
      />
      <Path
        d={glyphs.形.d}
        fill={glyph}
        transform={`translate(${bottom.tx} ${bottom.ty}) scale(${bottom.s})`}
      />
      <G opacity={0.55}>
        {specks.map((speck, i) => (
          <Circle
            key={i}
            cx={speck.x}
            cy={speck.y}
            r={speck.r}
            fill={i % 3 === 0 ? glyph : field}
          />
        ))}
      </G>
    </Svg>
  )
}

/** "Abu Studio" → "AS", "Zainab & Co." → "ZC", "Kemi" → "KE". */
export function monogramOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return "T"
  if (words.length === 1) return (words[0] ?? "T").slice(0, 2).toUpperCase()
  return words
    .slice(0, 3)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("")
}

export function BusinessSeal({
  name,
  band,
  size = 120,
  tilt = -6,
  color = SHU,
}: {
  name: string
  band?: string
  size?: number
  tilt?: number
  /** Ink: vermilion by default; white on the stage. */
  color?: string
}) {
  const id = useId().replace(/:/g, "")
  const c = VIEW / 2
  const ringR = 72
  const ringText = `${name.trim() || "Your business"} · TEGATA ·`.toUpperCase()
  const circumference = 2 * Math.PI * ringR
  const monogram = monogramOf(name)
  const specks = useSpecks(
    `biz-${name}`,
    size < 64 ? 0 : 60,
    (x, y) => (x - c) ** 2 + (y - c) ** 2 < 96 ** 2,
  )
  // Letter-spacing that fills the ring evenly for any length of name (Archivo Bold caps and spaces average ~0.86 em as react-native-svg lays them on a path).
  const fontSize = 17
  const spacing = Math.max(
    0.5,
    (circumference - 6 - ringText.length * fontSize * 0.86) / ringText.length,
  )
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      accessibilityLabel={`${name} seal`}
      style={{ transform: [{ rotate: `${tilt}deg` }] }}
    >
      <Defs>
        <Path
          id={`ring-${id}`}
          d={`M ${c - ringR} ${c} a ${ringR} ${ringR} 0 1 1 ${ringR * 2} 0 a ${ringR} ${ringR} 0 1 1 ${-ringR * 2} 0`}
        />
      </Defs>
      <Circle cx={c} cy={c} r={94} fill="none" stroke={color} strokeWidth={7} />
      <Circle cx={c} cy={c} r={56} fill="none" stroke={color} strokeWidth={3} />
      <SvgText
        fill={color}
        fontFamily={FONT.bold}
        fontSize={fontSize}
        letterSpacing={spacing}
        textLength={circumference - 6}
        lengthAdjust="spacing"
      >
        <TextPath href={`#ring-${id}`} startOffset="0">
          {ringText}
        </TextPath>
      </SvgText>
      {band ? (
        <>
          <Rect x={34} y={c - 17} width={132} height={34} rx={4} fill={color} />
          <SvgText
            x={c}
            y={c + 8}
            textAnchor="middle"
            fontFamily={FONT.display}
            fontSize={21}
            letterSpacing={1}
            fill={color === SHU ? PAPER.face : SHU}
          >
            {band.toUpperCase()}
          </SvgText>
        </>
      ) : (
        <SvgText
          x={c}
          y={c + (monogram.length > 2 ? 15 : 20)}
          textAnchor="middle"
          fontFamily={FONT.display}
          fontSize={monogram.length > 2 ? 46 : 58}
          fill={color}
        >
          {monogram}
        </SvgText>
      )}
      <G opacity={0.5}>
        {specks.map((speck, i) => (
          <Circle key={i} cx={speck.x} cy={speck.y} r={speck.r * 0.8} fill={PAPER.face} />
        ))}
      </G>
    </Svg>
  )
}
