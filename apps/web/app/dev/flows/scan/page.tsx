"use client"

// Scan in every state: real QR codes for each kind Tegata reads, decoded by the same code the camera uses
// (once with the browser's reader, once forced through jsQR, which iPhones use), and the scanner itself.
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { decodeQr, Scanner } from "@/components/scan/scanner"
import { readScanned, scannedHref } from "@/lib/scan"

/** `logo`: the same seal-in-the-middle settings the app's own codes use (link page, counter, Get paid sheet). */
const SAMPLES: {
  label: string
  value: string
  size?: number
  logo?: { src: string; size: number }
}[] = [
  {
    label: "Pay link page's code (seal in the middle)",
    value: "https://tegata.xyz/pay/k3Jd9sQm2Lx8",
    size: 208,
    logo: { src: "/icon.svg", size: 44 },
  },
  {
    label: "Counter sale's code (seal in the middle)",
    value: "https://tegata.xyz/pay/c9Vb2Tq7RzP4",
    size: 240,
    logo: { src: "/icon.svg", size: 48 },
  },
  {
    label: "Get paid sheet's code (NEAR mark in the middle)",
    value: "near:studio-kaze.tegata.testnet",
    size: 220,
    logo: { src: "/marks/near.svg", size: 40 },
  },
  { label: "Tegata pay link", value: "https://tegata.xyz/pay/demo-link-token" },
  { label: "Tegata invoice", value: "https://tegata.xyz/i/demo-invoice-token" },
  { label: "NEAR account", value: "studio-kaze.tegata.testnet" },
  {
    label: "EIP-681: USDC on Base",
    value:
      "ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x1111111111111111111111111111111111111111&uint256=25000000",
  },
  {
    label: "BIP-21: Bitcoin",
    value: "bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.0004",
  },
  {
    label: "Solana Pay: USDC",
    value:
      "solana:9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM?amount=12.5&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  { label: "Tron address", value: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE" },
]

async function readRendered(id: string, native: boolean) {
  const svg = document.getElementById(id)
  if (!svg) return null
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  await img.decode()
  // Drawn with a white border like the app's codes sit on (a quiet zone the camera sees too).
  const canvas = document.createElement("canvas")
  const pad = 24
  canvas.width = (img.naturalWidth || 240) + pad * 2
  canvas.height = (img.naturalHeight || 240) + pad * 2
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, pad, pad)
  const text = await decodeQr(canvas, canvas.width, canvas.height, { native })
  URL.revokeObjectURL(url)
  return text
}

export default function ScanFlow() {
  const [results, setResults] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-8 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="display text-[30px]">Scan</span>
        <Button
          size="sm"
          onClick={async () => {
            const out: Record<string, string> = {}
            for (const [i, sample] of SAMPLES.entries()) {
              for (const native of [true, false]) {
                const text = await readRendered(`qr-${i}`, native)
                const scanned = text ? readScanned(text) : null
                out[`${i}:${native ? "native" : "jsqr"}`] = scanned
                  ? `${text === sample.value ? "✓ exact" : "✗ differs"} · ${scanned.kind} → ${scannedHref(scanned) ?? "(shown)"}`
                  : "✗ not read"
              }
            }
            setResults(out)
          }}
        >
          Read every sample
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? "Close the scanner" : "Open the scanner"}
        </Button>
      </div>
      {open ? (
        <div className="max-w-[420px]">
          <Scanner
            active={open}
            onGo={(href) => setResults((r) => ({ ...r, scanner: `would open ${href}` }))}
          />
        </div>
      ) : null}
      {results.scanner ? <p className="font-mono text-[13px]">{results.scanner}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SAMPLES.map((sample, i) => (
          <figure key={sample.label} className="flex flex-col gap-2 rounded-[20px] bg-card p-4">
            <div className="self-center rounded-[16px] bg-white p-3">
              <QRCodeSVG
                id={`qr-${i}`}
                value={sample.value}
                size={sample.size ?? 200}
                level="M"
                imageSettings={
                  sample.logo
                    ? {
                        src: sample.logo.src,
                        height: sample.logo.size,
                        width: sample.logo.size,
                        excavate: true,
                      }
                    : undefined
                }
              />
            </div>
            <figcaption className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold">{sample.label}</span>
              <span className="break-all font-mono text-[12px] text-muted-foreground">
                {sample.value}
              </span>
              <span className="font-mono text-[12px]" data-result={`${i}:native`}>
                native: {results[`${i}:native`] ?? "–"}
              </span>
              <span className="font-mono text-[12px]" data-result={`${i}:jsqr`}>
                jsQR: {results[`${i}:jsqr`] ?? "–"}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
