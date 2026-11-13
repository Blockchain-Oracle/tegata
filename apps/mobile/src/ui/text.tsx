// Text in Tegata's roles (DESIGN.md "Type"). Money and page titles use the condensed display cut with tabular figures;
// words use Archivo at width 100; accounts and hashes use DM Mono. Sentence case everywhere.
import { Text as RNText, type TextProps, type TextStyle } from "react-native"

import { PAPER, TYPE, usePalette } from "@/theme/tokens"

type Role = keyof typeof TYPE
type Tone = "ink" | "text2" | "text3" | "white" | "black" | "up" | "down" | "seal" | "warn"

export function T({
  role = "body",
  tone = "ink",
  color,
  style,
  center,
  ...rest
}: Omit<TextProps, "role"> & { role?: Role; tone?: Tone; color?: string; center?: boolean }) {
  const p = usePalette()
  const tones: Record<Tone, string> = {
    ink: p.ink,
    text2: p.text2,
    text3: p.text3,
    white: "#FFFFFF",
    black: PAPER.ink,
    up: p.up,
    down: p.down,
    seal: p.sealInk,
    warn: p.warn,
  }
  const display = TYPE[role].fontFamily.includes("Condensed")
  const base: TextStyle = {
    ...TYPE[role],
    color: color ?? tones[tone],
    ...(display ? { fontVariant: ["tabular-nums", "lining-nums"], letterSpacing: -0.3 } : {}),
    ...(center ? { textAlign: "center" } : {}),
  }
  return <RNText allowFontScaling maxFontSizeMultiplier={1.4} {...rest} style={[base, style]} />
}
