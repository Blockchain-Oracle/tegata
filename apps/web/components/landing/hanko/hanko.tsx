"use client"

// Mounts the 3D hanko (scene.ts) after first paint. Until it has drawn, and wherever WebGL or motion is off,
// a still of the same moment stands in: the bill with the seal already pressed.
import { useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { TegataSeal } from "@/components/brand/seal"
import { Mark } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

import type { HankoCoin, HankoScene } from "./scene"
import { webglAvailable } from "./webgl"

export function Hanko({
  coins,
  className,
  night = false,
}: {
  coins: readonly HankoCoin[]
  className?: string
  /** Light the scene for a dark field whatever the page theme (the lacquer stage). */
  night?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [ready, setReady] = useState(false)
  const [still, setStill] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    // Reduced motion gets the still: the 3D desk breathes, orbits and leans even when it never presses.
    if (reduce || !webglAvailable()) {
      setStill(true)
      return
    }
    let scene: HankoScene | null = null
    let cancelled = false
    const css = getComputedStyle(document.documentElement)
    const fonts = {
      sans: css.getPropertyValue("--font-archivo").trim() || "sans-serif",
      mono: css.getPropertyValue("--font-dm-mono").trim() || "monospace",
    }
    const theme = new MutationObserver(() =>
      scene?.setTheme(document.documentElement.classList.contains("dark")),
    )
    // After first paint and idle, so the headline and buttons are never waiting on three.js.
    const idle = (cb: () => void) => {
      if (typeof window.requestIdleCallback === "function")
        window.requestIdleCallback(cb, { timeout: 900 })
      else setTimeout(cb, 200)
    }
    idle(async () => {
      const { HankoScene } = await import("./scene")
      if (cancelled) return
      scene = new HankoScene(el, {
        coins,
        fonts,
        autoPress: true,
        night,
        onContact: (byUser) => {
          if (byUser) fire("press", { cue: "stamp" })
        },
      })
      try {
        await scene.init()
        if (!cancelled) setReady(true)
      } catch {
        scene.dispose()
        scene = null
        if (!cancelled) setStill(true)
        return
      }
      // Unmounted while init() ran: the cleanup has already disposed the scene; watching <html> now would keep it alive.
      if (cancelled) return
      theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    })
    return () => {
      cancelled = true
      theme.disconnect()
      scene?.dispose()
    }
  }, [coins, reduce, night])

  return (
    <div className={cn("relative", className)}>
      <div
        ref={host}
        role="img"
        aria-label="Tegata's seal pressing a $1,250.00 invoice, with the coins a client can pay from in orbit"
        className={cn(
          "absolute inset-0 transition-opacity duration-700",
          ready ? "opacity-100" : "opacity-0",
          still && "hidden",
        )}
      />
      {/* The still: shown while three.js loads, and instead of it when WebGL is off. */}
      <div
        aria-hidden={!still}
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-500",
          ready && !still ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="relative w-[min(78%,340px)] -rotate-6 rounded-[18px] bg-[#FFFCF6] p-6 text-[#16130F] shadow-[0_30px_60px_-20px_#3b1a0a55]">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-[#5B544A]">
            <TegataSeal size={20} textured={false} /> Invoice · INV-0001
          </span>
          <p className="mt-4 text-[12px] font-medium text-[#6B6357]">Amount received</p>
          <p className="figure text-[64px] leading-none">$1,250.00</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2F7A00]">
            <Mark id="usdc" size={18} /> Exactly, in USDC on NEAR
          </p>
          <div className="mt-6 h-px bg-[#E9E3D6]" />
          <p className="mt-4 font-mono text-[13px]">studio.tegata.near</p>
          <div className="absolute right-4 bottom-4 rotate-[-6deg] opacity-90">
            <TegataSeal size={96} />
          </div>
        </div>
      </div>
    </div>
  )
}
