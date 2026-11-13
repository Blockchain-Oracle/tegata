"use client"

// "Get paid" (the receive sheet): the business's NEAR pay address with a QR, copy and share. Payers on other chains
// get pay links; this sheet is the address itself, which works today for anyone holding USDC on NEAR.
import { Check, Copy, Share2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"

import { BusinessSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { SandboxPill } from "@/components/kit/sandbox-pill"
import { Mark } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"

import { Sheet } from "./sheet"

const COPIED_MS = 1500

export function ReceiveSheet({
  open,
  onOpenChange,
  accountId,
  businessName,
  sandbox,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  businessName: string
  sandbox: boolean
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(accountId)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }
  const share = async () => {
    if (navigator.share)
      await navigator
        .share({ title: `Pay ${businessName}`, text: accountId })
        .catch(() => undefined)
    else await copy()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Get paid">
      <div className="flex flex-col items-center gap-5">
        <div className="relative rounded-[24px] bg-white p-4 shadow-receipt">
          <QRCodeSVG
            value={`near:${accountId}`}
            size={220}
            level="M"
            imageSettings={{ src: "/icon.svg", height: 40, width: 40, excavate: true }}
          />
          <div className="absolute -right-6 -bottom-6">
            <BusinessSeal name={businessName} size={76} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex items-center gap-2 font-mono text-[17px] font-medium">
            <Mark id="near" size={22} /> {accountId}
          </span>
          <span className="inline-flex items-center gap-1.5 text-detail text-muted-foreground">
            <Mark id="usdc" chain="near" size={18} /> USDC on NEAR
          </span>
          {sandbox ? <SandboxPill>Sandbox · test dollars</SandboxPill> : null}
        </div>
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="secondary" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
          </Button>
          <Button onClick={share} cue="tap">
            <Share2 /> Share
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
