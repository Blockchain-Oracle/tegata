"use client"

// The Sandbox / Live switch (plan feature 22: "one tap, like dark mode"): a two-position track whose selected side
// slides across. Sandbox is said in words and a dashed rim, never a hue. In the compact rail it shows the two icons
// only, and on a phone only the current mode is in words, so it always fits. Live carries a lock until the operator account on mainnet exists; tapping it then opens
// the sheet that says what Live is and what it waits for.
import { FlaskConical, Lock, Radio } from "lucide-react"
import { motion } from "motion/react"
import { useId, useState } from "react"

import { Mark } from "@/components/marks/mark"
import { switchMode } from "@/lib/client/mode"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

import { Sheet } from "./sheet"

type Mode = "sandbox" | "live"

const MODES = [
  { id: "sandbox", label: "Sandbox", Icon: FlaskConical },
  { id: "live", label: "Live", Icon: Radio },
] as const

export function ModeCapsule({
  live,
  liveAvailable,
  rail = false,
  className,
}: {
  live: boolean
  liveAvailable: boolean
  /** In the desktop rail: the current mode in words beside the seal; icons only when the rail is compact. */
  rail?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const pillId = useId()
  const current: Mode = live ? "live" : "sandbox"

  const pick = (next: Mode) => {
    if (next === current) return
    fire("tick", { cue: "toggle" })
    // Live switches only when the server has it on; until then the locked side explains what it waits for.
    if (next === "sandbox" || liveAvailable) switchMode(next)
    else setOpen(true)
  }

  return (
    <>
      <fieldset
        className={cn(
          "relative m-0 flex h-9 min-w-0 shrink-0 items-center rounded-full border-0 bg-secondary p-1",
          rail && "xl:h-10 xl:w-full",
          className,
        )}
      >
        <legend className="sr-only">Mode</legend>
        {MODES.map(({ id, label, Icon }) => {
          const on = id === current
          const locked = id === "live" && !liveAvailable
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              aria-label={locked ? `${label} (not open yet)` : label}
              title={locked ? "Live isn't open yet" : label}
              onClick={() => pick(id)}
              className={cn(
                "relative z-10 flex h-full items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors",
                // In the rail the mode you're in takes the room and keeps its word; the other is its icon.
                rail &&
                  (on ? "max-xl:w-7 max-xl:px-0 xl:flex-1" : "max-xl:w-7 max-xl:px-0 xl:px-2.5"),
                on
                  ? id === "live"
                    ? "text-background"
                    : "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {on ? (
                <motion.span
                  layoutId={`mode-${pillId}`}
                  transition={{ type: "spring", stiffness: 500, damping: 36 }}
                  className={cn(
                    "absolute inset-0 -z-10 rounded-full",
                    id === "live"
                      ? "bg-foreground"
                      : "border-[1.5px] border-dashed border-text-3 bg-card",
                  )}
                />
              ) : null}
              <Icon className="size-3.5 shrink-0" />
              {/* On a phone the bar is tight: the mode you're in is in words, the other is its icon. */}
              <span
                className={cn(rail ? cn("max-xl:hidden", !on && "hidden") : !on && "max-sm:hidden")}
              >
                {label}
              </span>
              {locked ? (
                <Lock
                  className={cn(
                    "size-3 shrink-0 opacity-60",
                    rail ? "max-xl:hidden" : "max-sm:hidden",
                  )}
                />
              ) : null}
            </button>
          )
        })}
      </fieldset>
      <Sheet open={open} onOpenChange={setOpen} title="Sandbox and Live">
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
                Test dollars on NEAR testnet, free. Nothing here costs real money.
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
              <span className="text-[15px] text-muted-foreground">
                Real dollars on{" "}
                <span className="inline-block align-[-3px]">
                  <Mark id="near" size={16} />
                </span>{" "}
                NEAR mainnet, paid in from any chain through{" "}
                <span className="inline-block align-[-3px]">
                  <Mark id="intents" size={16} />
                </span>{" "}
                NEAR Intents.
              </span>
              {!liveAvailable ? (
                <span className="inline-flex items-center gap-1.5 text-detail font-semibold text-warn">
                  <Lock className="size-3.5" /> Not open yet: Live is still being built.
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Sheet>
    </>
  )
}
