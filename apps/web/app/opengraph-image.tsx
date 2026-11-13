// The share card: the seal and the promise on the lacquer stage (sumi lit by a vermilion glow from below), with
// "exact" set on a block of seal ink as in the landing hero, in Archivo's condensed cut.
import { ImageResponse } from "next/og"

import { SEAL_FACES } from "@/lib/brand/glyphs"

export const alt =
  "Tegata. Get paid. Pay your team. In exact dollars. Invoices, pay links and payroll, settled in USDC on NEAR."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/** Two lines, as on the landing page: the promise, then "in exact dollars" in the quieter tone. */
const HEADLINE = ["Get paid. Pay your team.", "In exact dollars."] as const
const SUB = "Invoices, pay links and payroll, settled in USDC on NEAR."

/** Archivo at width 62, weight 900, subset to exactly the characters drawn (Google Fonts returns a TTF). */
async function archivo(text: string): Promise<ArrayBuffer> {
  const css = await (
    await fetch(
      `https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,900&text=${encodeURIComponent(text)}`,
    )
  ).text()
  const url = css.match(/src: url\((.+?)\) format/)?.[1]
  if (!url) throw new Error("Archivo font URL not found")
  return (await fetch(url)).arrayBuffer()
}

function Seal({ px }: { px: number }) {
  const g = SEAL_FACES.shippori.glyphs
  const VIEW = 200
  const pad = 30
  const cellH = (VIEW - pad * 2 - 6) / 2
  const fit = ([x1, y1, x2, y2]: readonly number[], x: number, y: number, w: number, h: number) => {
    const s = Math.min(w / (x2! - x1!), h / (y2! - y1!))
    return `translate(${x + (w - (x2! - x1!) * s) / 2 - x1! * s} ${y + (h - (y2! - y1!) * s) / 2 - y1! * s}) scale(${s})`
  }
  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      style={{ transform: "rotate(-4deg)" }}
      role="img"
      aria-label="Tegata seal"
    >
      <rect x="6" y="6" width="188" height="188" rx="30" fill="#FF4F00" />
      <rect
        x="18"
        y="18"
        width="164"
        height="164"
        rx="20"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5"
      />
      <path
        d={g.手.d}
        fill="#FFFFFF"
        transform={fit(g.手.box, pad, pad - 2, VIEW - pad * 2, cellH)}
      />
      <path
        d={g.形.d}
        fill="#FFFFFF"
        transform={fit(g.形.box, pad, pad + cellH + 8, VIEW - pad * 2, cellH)}
      />
    </svg>
  )
}

export default async function OpengraphImage() {
  const font = await archivo(`${HEADLINE.join("")}${SUB}Tegata`)
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: "#F2EDE4",
        backgroundColor: "#120D0A",
        backgroundImage:
          "radial-gradient(70% 95% at 85% 125%, #FF4F00 0%, #FF6A1A 28%, rgba(255,122,46,0.45) 52%, rgba(18,13,10,0) 78%), radial-gradient(40% 55% at 0% 0%, rgba(255,122,46,0.32) 0%, rgba(18,13,10,0) 72%)",
        fontFamily: "Archivo",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Seal px={84} />
        <span style={{ fontSize: 52 }}>Tegata</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 96, lineHeight: 0.95 }}>
          <span>{HEADLINE[0]}</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
            <span style={{ color: "#968C7F" }}>In</span>
            <span
              style={{
                backgroundColor: "#FF4F00",
                color: "#16130F",
                padding: "0 12px",
                borderRadius: 8,
              }}
            >
              exact
            </span>
            <span>dollars.</span>
          </span>
        </div>
        <span style={{ fontSize: 44, color: "#B8AFA2" }}>{SUB}</span>
      </div>
    </div>,
    { ...size, fonts: [{ name: "Archivo", data: font, weight: 900, style: "normal" }] },
  )
}
