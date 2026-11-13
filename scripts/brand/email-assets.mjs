// Writes the PNGs emails use (mail clients drop SVG): the Tegata seal, the seal as a tilted stamp, and the real coin,
// chain and partner marks. Run after scripts/brand/glyphs.mjs: node scripts/brand/email-assets.mjs (needs rsvg-convert).
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const pub = join(here, "../../apps/web/public")
const out = join(pub, "email")
mkdirSync(join(out, "marks"), { recursive: true })
const source = readFileSync(join(here, "../../apps/web/lib/brand/glyphs.ts"), "utf8")
// The glyph table is a plain object literal (Biome may unquote its keys), so evaluate it rather than JSON.parse it.
const faces = new Function(
  `return ${source.slice(source.indexOf("{", source.indexOf("SEAL_FACES")), source.lastIndexOf("} as const") + 1)}`,
)()
const glyphs = faces.shippori.glyphs
const VIEW = 200
const SHU = "#FF4F00"
function fit([x1, y1, x2, y2], x, y, w, h) {
  const s = Math.min(w / (x2 - x1), h / (y2 - y1))
  const tx = x + (w - (x2 - x1) * s) / 2 - x1 * s
  const ty = y + (h - (y2 - y1) * s) / 2 - y1 * s
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`
}
function seal({ inset, radius, ring, pad }) {
  const cellH = (VIEW - pad * 2 - 6) / 2
  return [
    `<rect x="${inset}" y="${inset}" width="${VIEW - inset * 2}" height="${VIEW - inset * 2}" rx="${radius}" fill="${SHU}"/>`,
    `<rect x="${inset + 12}" y="${inset + 12}" width="${VIEW - (inset + 12) * 2}" height="${VIEW - (inset + 12) * 2}" rx="${radius - 10}" fill="none" stroke="#fff" stroke-width="${ring}"/>`,
    `<path d="${glyphs.手.d}" fill="#fff" transform="${fit(glyphs.手.box, pad, pad - 2, VIEW - pad * 2, cellH)}"/>`,
    `<path d="${glyphs.形.d}" fill="#fff" transform="${fit(glyphs.形.box, pad, pad + cellH + 8, VIEW - pad * 2, cellH)}"/>`,
  ].join("")
}
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}">${body}</svg>`
function png(svgText, name, size) {
  const tmp = join(out, `${name}.tmp.svg`)
  writeFileSync(tmp, svgText)
  execFileSync("rsvg-convert", [
    "-w",
    String(size),
    "-h",
    String(size),
    tmp,
    "-o",
    join(out, `${name}.png`),
  ])
  rmSync(tmp)
}
const face = seal({ inset: 6, radius: 30, ring: 6, pad: 30 })
// The seal mark for the header (shown at 24 px), and the stamp pressed on a slip (shown at 88 px, ink a little thin).
png(svg(face), "seal", 96)
// The seal on paper (white square, vermilion glyphs) for the header on the vermilion stage.
const paper = face
  .replace(`fill="${SHU}"`, 'fill="#FFFFFF"')
  .replace('stroke="#fff"', `stroke="${SHU}"`)
  .replaceAll('fill="#fff"', `fill="${SHU}"`)
png(svg(paper), "seal-paper", 96)
png(
  svg(`<g opacity="0.92" transform="rotate(-8 100 100) translate(14 14) scale(0.86)">${face}</g>`),
  "stamp",
  192,
)
const MARKS = [
  "usdc",
  "usdt",
  "near",
  "intents",
  "circle",
  "eth",
  "base",
  "arb",
  "sol",
  "btc",
  "tron",
  "bnb",
  "pol",
  "gnosis",
  "unknown",
]
for (const id of MARKS) {
  execFileSync("rsvg-convert", [
    "-w",
    "64",
    "-h",
    "64",
    join(pub, "marks", `${id}.svg`),
    "-o",
    join(out, "marks", `${id}.png`),
  ])
}
console.log(`wrote public/email/{seal,stamp}.png and ${MARKS.length} marks`)
