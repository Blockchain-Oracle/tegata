import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

import { OG, SITE } from "./site"

/*
 * Link previews in the app's look: the lit vermilion stage, the 手形 seal, Archivo for the title. Drawn once at build
 * from files on disk, so the build needs no network for them.
 */

const read = (...parts: string[]) => readFile(join(process.cwd(), ...parts))
const assetsOnce = Promise.all([
  read("assets/fonts/archivo-latin-900-normal.woff"),
  read("assets/fonts/archivo-latin-600-normal.woff"),
  read("public/seal.svg"),
])

/** A preview card: the section, the page title and one line of description, on the stage. */
export async function ogImage({
  kicker,
  title,
  description,
}: {
  kicker: string
  title: string
  description?: string
}) {
  const [black, semibold, seal] = await assetsOnce
  const sealSrc = `data:image/svg+xml;base64,${seal.toString("base64")}`
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        backgroundColor: "#FF4F00",
        // Each light fades to its own colour at zero opacity: next/og blends `transparent` as black.
        backgroundImage:
          "radial-gradient(circle at 12% 8%, #FF7A2E 0%, rgba(255,122,46,0) 52%), radial-gradient(circle at 60% 110%, #FFB38A 0%, rgba(255,179,138,0) 55%)",
        color: "#FFFFFF",
        fontFamily: "Archivo",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <img src={sealSrc} width={56} height={56} alt="" />
        <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: -0.5 }}>{SITE.name}</span>
        <span
          style={{ width: 2, height: 32, background: "rgba(255,255,255,0.5)", margin: "0 6px" }}
        />
        <span style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
          {kicker}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000 }}>
        <span
          style={{
            fontSize: title.length > 30 ? 76 : 92,
            fontWeight: 900,
            lineHeight: 1.0,
            letterSpacing: -2,
          }}
        >
          {title}
        </span>
        {description ? (
          <span
            style={{
              fontSize: 30,
              fontWeight: 600,
              lineHeight: 1.3,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            {description}
          </span>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 24,
          fontWeight: 600,
          color: "rgba(255,255,255,0.88)",
        }}
      >
        <span>USDC on NEAR · gas paid by Tegata</span>
        <span style={{ marginLeft: "auto" }}>{SITE.url.replace("https://", "")}</span>
      </div>
    </div>,
    {
      ...OG,
      fonts: [
        { name: "Archivo", data: black, weight: 900, style: "normal" },
        { name: "Archivo", data: semibold, weight: 600, style: "normal" },
      ],
    },
  )
}
