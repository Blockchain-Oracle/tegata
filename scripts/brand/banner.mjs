// Writes the README banner (light and dark, 2560×1280) and the demo cover (1920×1080) into .github/assets, from SVG
// sources kept beside them. Text is drawn as glyph outlines from Archivo (OFL, @fontsource) so every renderer shows
// the same thing; the seal is the 手形 mark from app/icon.svg; coin and chain marks come from public/marks.
// Run: node scripts/brand/banner.mjs   (needs rsvg-convert)
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import opentype from "opentype.js"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "../..")
const out = join(root, ".github/assets")
const require = createRequire(import.meta.url)
const font = (weight) => {
  const buf = readFileSync(
    require.resolve(`@fontsource/archivo/files/archivo-latin-${weight}-normal.woff`),
  )
  const parsed = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  // opentype.js can't apply one of Archivo's contextual substitution lookups; plain text needs none.
  parsed.tables.gsub = undefined
  return parsed
}
const BOLD = font(800)
const SEMI = font(600)
const BOOK = font(400)

const SHU = "#FF4F00"
const THEMES = {
  light: { page: "#F5F5F5", ink: "#000000", muted: "#6E6E6E", soft: "#666666" },
  dark: { page: "#111111", ink: "#F5F5F5", muted: "#A0A0A0", soft: "#B8B8B8" },
}

/** Plain shaping: opentype.js misreads this font's ligature and kerning tables (NaN offsets); a banner needs neither. */
const PLAIN = { kerning: false, features: { liga: false, rlig: false } }
const n = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2))
/** SVG path data from glyph commands (opentype.js's own formatter emits NaN for some coordinates). */
const pathData = (path) =>
  path.commands
    .map((c) =>
      c.type === "M" || c.type === "L"
        ? `${c.type}${n(c.x)} ${n(c.y)}`
        : c.type === "Q"
          ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`
          : c.type === "C"
            ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`
            : "Z",
    )
    .join("")
const text = (f, s, x, y, size, fill, anchor = "start") => {
  const w = f.getAdvanceWidth(s, size, PLAIN)
  const dx = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x
  return `<path d="${pathData(f.getPath(s, dx, y, size, PLAIN))}" fill="${fill}"/>`
}
const width = (f, s, size) => f.getAdvanceWidth(s, size, PLAIN)
/** The largest size (≤ max) at which every line fits the width. */
const fitSize = (f, lines, max, maxWidth) =>
  Math.min(max, ...lines.map((l) => Math.floor((max * maxWidth) / width(f, l, max))))
function wrap(f, s, size, maxWidth) {
  const lines = []
  let line = ""
  for (const word of s.split(" ")) {
    const next = line ? `${line} ${word}` : word
    if (width(f, next, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

const sealInner = readFileSync(join(root, "apps/web/app/icon.svg"), "utf8")
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
const seal = (x, y, size) =>
  `<g transform="translate(${x} ${y}) scale(${size / 200})">${sealInner}</g>`
const mark = (id, x, y, size) => {
  const svg = readFileSync(join(root, `apps/web/public/marks/${id}.svg`)).toString("base64")
  return `<image href="data:image/svg+xml;base64,${svg}" x="${x}" y="${y}" width="${size}" height="${size}"/>`
}

/** The round business seal stamped PAID: rings, the name around the ring, a solid band. */
function paidSeal(cx, cy, r, name) {
  const ring = `${name} · TEGATA · `.toUpperCase()
  const size = r * 0.17
  const total = ring.split("").reduce((sum, ch) => sum + width(BOLD, ch, size), 0)
  const rr = r * 0.78
  const gap = (2 * Math.PI * rr - total) / ring.length
  let angle = -Math.PI / 2
  const letters = []
  for (const ch of ring) {
    const w = width(BOLD, ch, size)
    const mid = angle + w / 2 / rr
    const x = cx + rr * Math.cos(mid)
    const y = cy + rr * Math.sin(mid)
    const deg = (mid * 180) / Math.PI + 90
    letters.push(
      `<path d="${pathData(BOLD.getPath(ch, -w / 2, size * 0.35, size, PLAIN))}" fill="${SHU}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})"/>`,
    )
    angle += (w + gap) / rr
  }
  const band = r * 0.36
  return `<g transform="rotate(-8 ${cx} ${cy})">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${SHU}" stroke-width="${r * 0.07}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.6}" fill="none" stroke="${SHU}" stroke-width="${r * 0.03}"/>
    ${letters.join("")}
    <rect x="${cx - r * 0.66}" y="${cy - band / 2}" width="${r * 1.32}" height="${band}" rx="${r * 0.04}" fill="${SHU}"/>
    ${text(BOLD, "PAID", cx, cy + band * 0.3, band * 0.78, "#FFFFFF", "middle")}
  </g>`
}

/** The lit vermilion stage with a paper invoice on it: the product's own objects. */
function stage(x, y, w, h, scale = 1, paperCenterX = x + w / 2) {
  const s = (v) => v * scale
  const px = paperCenterX - s(330)
  const py = y + h / 2 - s(380)
  const row = (label, amount, yy, f = BOOK, size = s(26), color = "#444444") =>
    `${text(f, label, px + s(48), yy, size, color)}${text(f, amount, px + s(612), yy, size, color, "end")}`
  return `
  <defs>
    <radialGradient id="hot" cx="0.16" cy="0.1" r="0.6"><stop offset="0" stop-color="#FF7A2E"/><stop offset="1" stop-color="#FF7A2E" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow" cx="0.55" cy="1.05" r="0.7"><stop offset="0" stop-color="#FFB38A"/><stop offset="1" stop-color="#FFB38A" stop-opacity="0"/></radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${s(24)}" stdDeviation="${s(30)}" flood-color="#5A1A00" flood-opacity="0.35"/></filter>
    <clipPath id="stageclip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s(72)}"/></clipPath>
  </defs>
  <g clip-path="url(#stageclip)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${SHU}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#hot)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#glow)"/>
    <ellipse cx="${x + w * 0.3}" cy="${y - s(40)}" rx="${s(360)}" ry="${s(160)}" fill="#FFFFFF" opacity="0.12"/>
  </g>
  <g transform="rotate(-3 ${x + w / 2} ${y + h / 2})" filter="url(#shadow)">
    <rect x="${px}" y="${py}" width="${s(660)}" height="${s(760)}" rx="${s(40)}" fill="#FFFFFF"/>
    ${text(BOLD, "Invoice", px + s(48), py + s(108), s(64), "#000000")}
    ${text(SEMI, "INV-0007", px + s(612), py + s(100), s(26), "#666666", "end")}
    ${text(SEMI, "Bill to", px + s(48), py + s(178), s(22), "#666666")}
    ${text(SEMI, "Northwind Ltd", px + s(48), py + s(214), s(30), "#000000")}
    ${text(SEMI, "Due", px + s(400), py + s(178), s(22), "#666666")}
    ${text(SEMI, "26 Nov 2026", px + s(400), py + s(214), s(30), "#000000")}
    <rect x="${px + s(48)}" y="${py + s(262)}" width="${s(564)}" height="${s(2)}" fill="#ECECEC"/>
    ${row("Brand identity and seal", "$1,000.00", py + s(318))}
    ${row("Design hours, 5 × $50.00", "$250.00", py + s(370))}
    <rect x="${px + s(48)}" y="${py + s(402)}" width="${s(564)}" height="${s(2)}" fill="#ECECEC"/>
    ${text(SEMI, "Total", px + s(48), py + s(500), s(30), "#000000")}
    ${text(BOLD, "$1,250.00", px + s(612), py + s(510), s(84), "#000000", "end")}
    <rect x="${px + s(48)}" y="${py + s(600)}" width="${s(564)}" height="${s(2)}" fill="#ECECEC"/>
    ${mark("usdc", px + s(48), py + s(644), s(40))}
    ${mark("near", px + s(80), py + s(644), s(40))}
    ${text(SEMI, "USDC on NEAR", px + s(136), py + s(674), s(26), "#444444")}
    ${paidSeal(px + s(548), py + s(694), s(112), "Studio Kaze")}
  </g>`
}

const HEADLINE = ["Send an invoice.", "Get paid in", "exact dollars."]
const SUB =
  "Invoices and pay links for small businesses, settled in USDC on NEAR. Sign in with email; Tegata pays every network fee; every payment gets a sealed receipt."

function banner(theme) {
  const t = THEMES[theme]
  const W = 2560
  const H = 1280
  const left = 150
  const colW = 1140
  const hs = fitSize(BOLD, HEADLINE, 150, colW)
  const sub = wrap(BOOK, SUB, 40, colW - 40)
  const headTop = 470
  const lines = HEADLINE.map((l, i) =>
    text(BOLD, l, left, headTop + i * hs * 1.02, hs, i === 0 ? t.ink : t.muted),
  ).join("")
  const subTop = headTop + (HEADLINE.length - 1) * hs * 1.02 + 110
  const subLines = sub.map((l, i) => text(BOOK, l, left, subTop + i * 58, 40, t.soft)).join("")
  const chipY = subTop + sub.length * 58 + 70
  const chips = [
    ["usdc", "USDC on NEAR"],
    ["intents", "NEAR Intents"],
    ["near", "Gas paid by Tegata"],
  ]
  let cx = left
  const chipRow = chips
    .map(([id, label]) => {
      const piece = `${mark(id, cx, chipY - 34, 44)}${text(SEMI, label, cx + 58, chipY, 30, t.ink)}`
      cx += 58 + width(SEMI, label, 30) + 56
      return piece
    })
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <title>Tegata. Send an invoice. Get paid in exact dollars.</title>
  <rect width="${W}" height="${H}" fill="${t.page}"/>
  ${seal(left, 150, 150)}
  ${text(BOLD, "Tegata", left + 190, 262, 112, t.ink)}
  ${text(SEMI, "a written promise to pay", left + 190 + width(BOLD, "Tegata", 112) + 36, 258, 30, t.muted)}
  ${lines}
  ${subLines}
  ${chipRow}
  ${stage(1380, 140, 1030, 1000, 1.12)}
</svg>`
}

function cover() {
  const t = THEMES.dark
  const W = 1920
  const H = 1080
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <title>Try Tegata live: make an invoice, no sign-up.</title>
  <rect width="${W}" height="${H}" fill="${t.page}"/>
  ${stage(110, 110, 1700, 860, 0.92, 1330)}
  ${seal(190, 180, 96)}
  ${text(BOLD, "Tegata", 310, 252, 72, "#FFFFFF")}
  ${text(BOLD, "Try it live.", 190, 470, 96, "#FFFFFF")}
  ${text(SEMI, "Make an invoice, no sign-up.", 190, 550, 46, "#FFFFFF")}
  <circle cx="300" cy="740" r="110" fill="#000000" opacity="0.5"/>
  <circle cx="300" cy="740" r="110" fill="none" stroke="#FFFFFF" stroke-width="6"/>
  <path d="M 270 688 L 358 740 L 270 792 Z" fill="#FFFFFF"/>
</svg>`
}

for (const theme of ["light", "dark"]) {
  const svgPath = join(out, `banner-${theme}.svg`)
  writeFileSync(svgPath, banner(theme))
  execFileSync("rsvg-convert", [
    "-w",
    "2560",
    "-h",
    "1280",
    "-o",
    join(out, `banner-${theme}.png`),
    svgPath,
  ])
}
writeFileSync(join(out, "demo-cover.svg"), cover())
execFileSync("rsvg-convert", [
  "-w",
  "1920",
  "-h",
  "1080",
  "-o",
  join(out, "demo-cover.png"),
  join(out, "demo-cover.svg"),
])
console.log("banner-light.png, banner-dark.png and demo-cover.png written to .github/assets")
