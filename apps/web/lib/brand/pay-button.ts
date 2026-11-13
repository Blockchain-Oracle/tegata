// The Tegata pay button as one SVG, the way Shop Pay and PayPal are recognised at a glance: a solid Tegata colour,
// the 手形 seal, the words in Archivo (drawn as outlines, so no font is needed on the merchant's site) and the real
// marks of the coins a customer can pay with. Served at /checkout/button.svg and drawn by checkout.js.
import {
  COIN_MARKS,
  GLYPHS_800,
  GLYPHS_900,
  SEAL_PAPER,
  SEAL_SHU,
} from "@/lib/brand/pay-button-assets"

export type PayButtonTheme = "shu" | "ink" | "washi"
export type PayButtonSize = "s" | "m" | "l"

const HEIGHT: Record<PayButtonSize, number> = { s: 40, m: 48, l: 56 }

const THEME: Record<
  PayButtonTheme,
  { bg: string; text: string; seal: string; border: string | null }
> = {
  // Vermilion: the seal turns white so it reads on its own colour.
  shu: { bg: "#FF4F00", text: "#FFFFFF", seal: SEAL_PAPER, border: null },
  ink: { bg: "#16130F", text: "#F3EFE6", seal: SEAL_SHU, border: null },
  washi: { bg: "#F3EFE6", text: "#16130F", seal: SEAL_SHU, border: "rgba(22,19,15,0.16)" },
}

const COINS = ["usdc", "usdt", "eth", "sol", "btc"] as const

type Glyphs = Record<string, { d: string; w: number }>

const textWidth = (glyphs: Glyphs, text: string, size: number) =>
  [...text].reduce((sum, ch) => sum + (glyphs[ch]?.w ?? 500), 0) * (size / 1000)

function textPaths(glyphs: Glyphs, text: string, x: number, baseline: number, size: number) {
  let cursor = 0
  const parts: string[] = []
  for (const ch of text) {
    const glyph = glyphs[ch]
    if (glyph?.d) parts.push(`<path transform="translate(${cursor} 0)" d="${glyph.d}"/>`)
    cursor += glyph?.w ?? 500
  }
  const k = size / 1000
  return `<g transform="translate(${x.toFixed(2)} ${baseline.toFixed(2)}) scale(${k.toFixed(4)})">${parts.join("")}</g>`
}

const money = (dollars: string) =>
  Number(dollars).toLocaleString("en-US", { style: "currency", currency: "USD" })

/** "Pay $42.50" with the seal and the coins, or the seal and "Tegata" alone when there's no amount. */
export function payButtonSvg(input: {
  amount?: string | null
  theme?: PayButtonTheme
  size?: PayButtonSize
  coins?: boolean
}) {
  const theme = THEME[input.theme ?? "shu"]
  const h = HEIGHT[input.size ?? "m"]
  const pad = Math.round(h * 0.4)
  const sealSize = Math.round(h * 0.58)
  const gap = Math.round(h * 0.24)
  const amount = input.amount ? money(input.amount) : null
  // The wordmark in the heaviest cut; "Pay $42.50" one step lighter so the figure reads first.
  const glyphs = amount ? GLYPHS_800 : GLYPHS_900
  const label = amount ? `Pay ${amount}` : "Tegata"
  const size = h * (amount ? 0.38 : 0.42)
  const labelW = textWidth(glyphs, label, size)
  const showCoins = input.coins ?? true
  const coin = Math.round(h * 0.42)
  const step = coin * 0.64
  const coinsW = showCoins ? coin + step * (COINS.length - 1) : 0
  const coinsGap = showCoins ? Math.round(h * 0.34) : 0
  const w = Math.round(pad + sealSize + gap + labelW + coinsGap + coinsW + pad)
  const baseline = h / 2 + size * 0.36
  const sealY = (h - sealSize) / 2
  const labelX = pad + sealSize + gap
  const coinsX = labelX + labelW + coinsGap
  const coinY = (h - coin) / 2
  const coinMarks = showCoins
    ? COINS.map((id, i) => {
        const cx = coinsX + i * step + coin / 2
        const cy = h / 2
        // Each coin is clipped round and sits on a ring of the button's own colour, so the stack reads as coins.
        return `<clipPath id="tc${i}"><circle cx="${cx.toFixed(1)}" cy="${cy}" r="${(coin / 2).toFixed(1)}"/></clipPath><circle cx="${cx.toFixed(1)}" cy="${cy}" r="${(coin / 2 + h * 0.04).toFixed(1)}" fill="${theme.bg}"/><image href="${COIN_MARKS[id]}" x="${(cx - coin / 2).toFixed(1)}" y="${coinY.toFixed(1)}" width="${coin}" height="${coin}" clip-path="url(#tc${i})" preserveAspectRatio="xMidYMid slice"/>`
      }).join("")
    : ""
  const radius = Math.round(h * 0.28)
  const label_ = amount ? `Pay ${amount} with Tegata` : "Pay with Tegata"
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label_}"><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${radius}" fill="${theme.bg}"${theme.border ? ` stroke="${theme.border}"` : ""}/><g transform="translate(${pad} ${sealY.toFixed(1)}) rotate(-4 ${sealSize / 2} ${sealSize / 2}) scale(${(sealSize / 200).toFixed(4)})">${theme.seal}</g><g fill="${theme.text}">${textPaths(glyphs, label, labelX, baseline, size)}</g>${coinMarks}</svg>`
}

export const PAY_BUTTON_THEMES = ["shu", "ink", "washi"] as const
export const PAY_BUTTON_SIZES = ["s", "m", "l"] as const
