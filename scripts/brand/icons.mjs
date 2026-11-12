// Writes the favicon (app/icon.svg) and the home-screen icon (app/apple-icon.png) from the seal's glyph paths.
// Run after scripts/brand/glyphs.mjs: node scripts/brand/icons.mjs (needs rsvg-convert for the PNG).
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const app = join(here, "../../apps/web/app")
const source = readFileSync(join(here, "../../apps/web/lib/brand/glyphs.ts"), "utf8")
const faces = JSON.parse(
  source.slice(
    source.indexOf("{", source.indexOf("SEAL_FACES")),
    source.lastIndexOf("} as const") + 1,
  ),
)
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
const svg = (body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}">${bg ? `<rect width="${VIEW}" height="${VIEW}" fill="${bg}"/>` : ""}${body}</svg>`

// Favicon: the seal edge to edge, a bolder ring so it holds at 16 px.
writeFileSync(join(app, "icon.svg"), svg(seal({ inset: 4, radius: 34, ring: 8, pad: 30 })))
// Home-screen icon: the seal on paper, room around it for the platform's mask.
const apple = svg(
  `<g transform="translate(26 26) scale(0.74)">${seal({ inset: 6, radius: 30, ring: 6, pad: 30 })}</g>`,
  "#FFFFFF",
)
const tmp = join(here, "apple-icon.svg")
writeFileSync(tmp, apple)
execFileSync("rsvg-convert", ["-w", "180", "-h", "180", tmp, "-o", join(app, "apple-icon.png")])
execFileSync("rm", [tmp])
console.log("wrote app/icon.svg and app/apple-icon.png")
