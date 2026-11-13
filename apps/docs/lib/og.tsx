import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

import { OG, SITE } from "./site"

/*
 * Link previews in the app's look: the lacquer stage (sumi lit by a vermilion glow from below), the 手形 seal,
 * Archivo for the title. Drawn once at build
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
        backgroundColor: "#120D0A",
        // Each light fades to the field's own colour at zero opacity: next/og blends `transparent` as black.
        backgroundImage:
          "radial-gradient(70% 95% at 85% 125%, #FF4F00 0%, #FF6A1A 28%, rgba(255,122,46,0.45) 52%, rgba(18,13,10,0) 78%), radial-gradient(40% 55% at 0% 0%, rgba(255,122,46,0.32) 0%, rgba(18,13,10,0) 72%)",
        color: "#F2EDE4",
        fontFamily: "Archivo",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <img src={sealSrc} width={56} height={56} alt="" />
        <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: -0.5 }}>{SITE.name}</span>
        <span
          style={{ width: 2, height: 32, background: "rgba(242,237,228,0.35)", margin: "0 6px" }}
        />
        <span style={{ fontSize: 26, fontWeight: 600, color: "#B8AFA2" }}>{kicker}</span>
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
              color: "#B8AFA2",
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
          color: "#B8AFA2",
        }}
      >
        <span>USDC on NEAR · fees paid by Tegata</span>
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
