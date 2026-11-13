"use client"

// The interactive bits of /download: a QR plate for the phone in your other hand, and the APK's checksum with copy.
import { Check, Copy } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"

import { fire } from "@/lib/feedback"

export function QrPlate({ url, caption }: { url: string; caption: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[20px] bg-secondary p-4">
      <div className="rounded-[14px] bg-white p-2.5">
        <QRCodeSVG
          value={url}
          size={112}
          level="M"
          imageSettings={{ src: "/icon.svg", height: 22, width: 22, excavate: true }}
        />
      </div>
      <span className="text-detail text-muted-foreground">{caption}</span>
    </div>
  )
}

export function Checksum({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        fire("tick", { cue: "confirmed" })
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="press group flex w-full items-start gap-3 rounded-[16px] bg-secondary p-4 text-left hover:bg-plate-pressed"
      aria-label="Copy the SHA-256 checksum"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13px] font-semibold text-text-3">SHA-256</span>
        <span className="font-mono text-[13px] leading-[1.45] break-all">{value}</span>
      </span>
      <span className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground [&_svg]:size-4">
        {copied ? <Check className="text-up" /> : <Copy />}
      </span>
    </button>
  )
}
