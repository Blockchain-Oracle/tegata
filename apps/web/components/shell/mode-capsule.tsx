"use client"

// The Sandbox / Live capsule (21st haydenbleasel/pill 1600 on Senryo's spec): said in words and a dashed rim, never a
// hue. One tap opens the mode sheet; Live names what it needs until the operator account on mainnet exists.
import { FlaskConical, Radio } from "lucide-react"
import { useState } from "react"

import { Mark } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

import { Sheet } from "./sheet"

export function ModeCapsule({
  live,
  liveAvailable,
  className,
}: {
  live: boolean
  liveAvailable: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          fire("tick", { cue: "toggle" })
          setOpen(true)
        }}
        className={cn(
          "press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold",
          live
            ? "bg-foreground text-background"
            : "border-[1.5px] border-dashed border-text-3 text-foreground",
          className,
        )}
      >
        {live ? <Radio className="size-3.5" /> : <FlaskConical className="size-3.5" />}
        {live ? "Live" : "Sandbox"}
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Mode">
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              "flex items-start gap-3 rounded-[16px] p-4",
              !live ? "bg-shu-wash" : "bg-secondary",
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-text-3">
              <FlaskConical className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[17px] font-semibold">Sandbox {!live ? "· on" : ""}</span>
              <span className="text-[15px] text-muted-foreground">
                Test dollars on NEAR testnet. Every screen works the same, nothing costs real money.
              </span>
            </div>
          </div>
          <div
            className={cn(
              "flex items-start gap-3 rounded-[16px] p-4",
              live ? "bg-shu-wash" : "bg-secondary",
              !liveAvailable && "opacity-70",
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-foreground text-background">
              <Radio className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[17px] font-semibold">Live {live ? "· on" : ""}</span>
              <span className="inline-flex flex-wrap items-center gap-1.5 text-[15px] text-muted-foreground">
                Real dollars on <Mark id="near" size={16} /> NEAR mainnet, paid in from any chain
                through
                <Mark id="intents" size={16} /> NEAR Intents.
              </span>
              {!liveAvailable ? (
                <span className="text-detail font-semibold text-warn">
                  Opens once tegata.near is funded.
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Sheet>
    </>
  )
}
