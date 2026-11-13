// The share card: the seal and the promise on the lit stage, in Archivo's condensed cut.
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
    >
      <title>Tegata seal</title>
      <rect x="6" y="6" width="188" height="188" rx="30" fill="#FFFFFF" />
      <rect
        x="18"
        y="18"
        width="164"
        height="164"
        rx="20"
        fill="none"
        stroke="#FF4F00"
        strokeWidth="5"
      />
      <path
        d={g.手.d}
        fill="#FF4F00"
        transform={fit(g.手.box, pad, pad - 2, VIEW - pad * 2, cellH)}
      />
      <path
        d={g.形.d}
        fill="#FF4F00"
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
        color: "#FFFFFF",
        backgroundColor: "#FF4F00",
        backgroundImage:
          "radial-gradient(60% 55% at 16% 10%, #FF7A2E 0%, rgba(255,122,46,0) 70%), radial-gradient(70% 60% at 55% 105%, #FFB38A 0%, rgba(255,179,138,0) 65%)",
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
          <span style={{ opacity: 0.8 }}>{HEADLINE[1]}</span>
        </div>
        <span style={{ fontSize: 44, opacity: 0.85 }}>{SUB}</span>
      </div>
    </div>,
    { ...size, fonts: [{ name: "Archivo", data: font, weight: 900, style: "normal" }] },
  )
}
