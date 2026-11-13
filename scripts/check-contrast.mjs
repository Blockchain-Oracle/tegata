// Every text colour on every surface it's used on, in light and dark, must reach WCAG AA (4.5:1).
// Reads the tokens straight from apps/web/app/globals.css, so a token change that breaks contrast fails here.
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8")
const block = (selector) => {
  const start = css.indexOf(`${selector} {`)
  return Object.fromEntries(
    [
      ...css.slice(start, css.indexOf("\n}", start)).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi),
    ].map((m) => [m[1], m[2]]),
  )
}
const light = block(":root")
const dark = { ...light, ...block(".dark") }

/** [text token, surface token]: the pairs the app actually draws. */
const PAIRS = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "secondary"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "secondary"],
  ["text-3", "background"],
  ["text-3", "card"],
  ["primary-foreground", "primary"],
  ["shu-ink", "card"],
  ["shu-ink", "background"],
  ["shu-ink", "shu-wash"],
  ["up", "card"],
  ["down", "card"],
  ["warn", "card"],
  ["up", "up-surface"],
  ["down", "down-surface"],
  ["warn", "warn-surface"],
  ["destructive", "card"],
]
/** Large display text (24 px and up) only needs 3:1 under WCAG AA. */
const LARGE = [["#ffffff", "#ff4f00", "white figures on the stage (display, 60 px and up)"]]
/** Known gaps, printed but not failed: decided in the plan, not by this script. */
const KNOWN = [["#ffffff", "#ff4f00", "small white labels on the stage (a brand decision)"]]
/** Fixed pairs that don't change with the theme (the stage is lit in both). */
const FIXED = [
  ["#000000", "#ff4f00", "ink on the shu button"],
  ["#ffffff", "#1b1f5e", "white on the ai story field"],
  ["#000000", "#c8f06a", "ink on matcha"],
  ["#000000", "#a9d8ff", "ink on sora"],
  ["#000000", "#ffc2d6", "ink on sakura"],
  ["#000000", "#ffd23f", "ink on kin"],
  ["#ffffff", "#2f7a00", "white on the paid counter stage"],
]

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const ch = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const AA = 4.5
const AA_LARGE = 3
let failed = 0
const report = (label, fg, bg, need = AA) => {
  const r = ratio(fg, bg)
  const ok = r >= need
  if (!ok) failed++
  console.log(`${ok ? "ok  " : "FAIL"} ${r.toFixed(2).padStart(5)}  ${label}`)
}
for (const [theme, tokens] of [
  ["light", light],
  ["dark", dark],
]) {
  for (const [fg, bg] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) continue
    report(`${theme}: ${fg} on ${bg}`, tokens[fg], tokens[bg])
  }
}
for (const [fg, bg, label] of FIXED) report(label, fg, bg)
for (const [fg, bg, label] of LARGE) report(label, fg, bg, AA_LARGE)
for (const [fg, bg, label] of KNOWN)
  console.log(`warn ${ratio(fg, bg).toFixed(2).padStart(5)}  ${label}`)
console.log(
  failed
    ? `\n${failed} pair(s) fail AA`
    : `\nEvery pair passes AA (${AA}:1 for text, ${AA_LARGE}:1 for display figures)`,
)
process.exit(failed ? 1 : 0)
