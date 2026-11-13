// Writes the phone app's icon, Android adaptive layers and splash mark from the seal's glyph paths (the same outlines
// as the web's favicon, apps/web/lib/brand/glyphs.ts). Run: node apps/mobile/scripts/icons.mjs (needs rsvg-convert).
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, "../assets/brand")
// Node strips the types from the generated glyph module, so the outlines come straight from the web's source.
const { SEAL_FACES } = await import("../../web/lib/brand/glyphs.ts")
const glyphs = SEAL_FACES.shippori.glyphs

const VIEW = 200
const SHU = "#FF4F00"
function fit([x1, y1, x2, y2], x, y, w, h) {
  const s = Math.min(w / (x2 - x1), h / (y2 - y1))
  const tx = x + (w - (x2 - x1) * s) / 2 - x1 * s
  const ty = y + (h - (y2 - y1) * s) / 2 - y1 * s
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`
}
/** The square seal: `field` behind, `ink` for the inner rule and the two glyphs. */
function seal({ field, ink, inset = 6, radius = 30, ring = 6, pad = 30 }) {
  const cellH = (VIEW - pad * 2 - 6) / 2
  return [
    field ? `<rect x="${inset}" y="${inset}" width="${VIEW - inset * 2}" height="${VIEW - inset * 2}" rx="${radius}" fill="${field}"/>` : "",
    `<rect x="${inset + 12}" y="${inset + 12}" width="${VIEW - (inset + 12) * 2}" height="${VIEW - (inset + 12) * 2}" rx="${radius - 10}" fill="none" stroke="${ink}" stroke-width="${ring}"/>`,
    `<path d="${glyphs.手.d}" fill="${ink}" transform="${fit(glyphs.手.box, pad, pad - 2, VIEW - pad * 2, cellH)}"/>`,
    `<path d="${glyphs.形.d}" fill="${ink}" transform="${fit(glyphs.形.box, pad, pad + cellH + 8, VIEW - pad * 2, cellH)}"/>`,
  ].join("")
}
/** The lit vermilion stage: base, a hot light upper left, a pale glow lower centre. */
const stage = `<defs>
  <radialGradient id="hot" cx="0.16" cy="0.1" r="0.62"><stop offset="0" stop-color="#FF7A2E"/><stop offset="1" stop-color="#FF7A2E" stop-opacity="0"/></radialGradient>
  <radialGradient id="glow" cx="0.55" cy="1.05" r="0.7"><stop offset="0" stop-color="#FFB38A"/><stop offset="1" stop-color="#FFB38A" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${VIEW}" height="${VIEW}" fill="${SHU}"/>
<rect width="${VIEW}" height="${VIEW}" fill="url(#hot)"/>
<rect width="${VIEW}" height="${VIEW}" fill="url(#glow)" opacity="0.7"/>`
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}">${body}</svg>`
/** The seal centred at `scale` of the canvas, tilted like a stamp. */
const placed = (body, scale, tilt = -4) =>
  `<g transform="rotate(${tilt} 100 100) translate(${(VIEW * (1 - scale)) / 2} ${(VIEW * (1 - scale)) / 2}) scale(${scale})">${body}</g>`

const files = {
  // iOS and the store: the white seal (vermilion glyphs) on the lit stage, no transparency.
  "icon.png": [svg(stage + placed(seal({ field: "#FFFFFF", ink: SHU }), 0.62)), 1024],
  // Android adaptive: the stage behind, the seal in the 66% safe circle in front, and a one-colour version.
  "android-background.png": [svg(stage), 1024],
  "android-foreground.png": [svg(placed(seal({ field: "#FFFFFF", ink: SHU }), 0.5)), 1024],
  "android-monochrome.png": [svg(placed(seal({ field: "#000000", ink: "#FFFFFF" }), 0.5)), 1024],
  // Splash: the vermilion seal on paper.
  "splash.png": [svg(placed(seal({ field: SHU, ink: "#FFFFFF" }), 1, 0)), 512],
  "favicon.png": [svg(seal({ field: SHU, ink: "#FFFFFF", inset: 4, radius: 34, ring: 8 })), 64],
}

const tmp = mkdtempSync(join(tmpdir(), "tegata-icons-"))
for (const [name, [body, size]] of Object.entries(files)) {
  const file = join(tmp, `${name}.svg`)
  writeFileSync(file, body)
  execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), file, "-o", join(out, name)])
}
rmSync(tmp, { recursive: true })
// iOS refuses an icon with an alpha channel: flatten it.
execFileSync("magick", [join(out, "icon.png"), "-background", SHU, "-alpha", "remove", "-alpha", "off", join(out, "icon.png")])
console.log(`wrote ${Object.keys(files).join(", ")} to assets/brand`)
