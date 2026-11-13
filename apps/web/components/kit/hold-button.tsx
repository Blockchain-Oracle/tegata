"use client"

// Hold to confirm (21st ddoemonn/hold-to-confirm 23527, from our earlier Senryo kit): the plate sweeps a darker fill
// while held and fires only when the sweep completes; letting go early drains it 2.5× faster. A keyboard or
// assistive-tech activation confirms at once. When it can't fire, the label names what's missing.
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

const HOLD_MS = 1200
const RELEASE_RATE = 2.5
const MOVE_TOLERANCE = 10
const RELEASE_EASE = [0.23, 1, 0.32, 1] as const

export function HoldButton({
  label,
  holdingLabel = "Keep holding…",
  ready = true,
  busy = false,
  onConfirm,
  className,
}: {
  label: string
  holdingLabel?: string
  ready?: boolean
  busy?: boolean
  onConfirm: () => void
  className?: string
}) {
  const live = ready && !busy
  const [holding, setHolding] = useState(false)
  const swept = useMotionValue(0)
  const clipPath = useTransform(swept, (v) => `inset(0 ${(1 - v) * 100}% 0 0)`)
  const reduced = useReducedMotion()
  const origin = useRef<{ x: number; y: number } | null>(null)
  const hint = useId()
  const confirm = useRef(onConfirm)
  confirm.current = onConfirm

  const done = useCallback(() => {
    fire("confirm", { cue: "confirmed" })
    confirm.current()
  }, [])

  useEffect(() => {
    if (!live) swept.set(0)
  }, [live, swept])

  useEffect(() => {
    const from = swept.get()
    if (holding) {
      const run = animate(swept, 1, {
        duration: reduced ? 0 : (HOLD_MS * (1 - from)) / 1000,
        ease: "linear",
        onComplete: () => {
          setHolding(false)
          swept.set(0)
          done()
        },
      })
      return () => run.stop()
    }
    const run = animate(swept, 0, {
      duration: (HOLD_MS * from) / RELEASE_RATE / 1000,
      ease: RELEASE_EASE,
    })
    return () => run.stop()
  }, [holding, reduced, swept, done])

  const release = () => {
    origin.current = null
    setHolding(false)
  }

  return (
    <button
      type="button"
      aria-disabled={!live}
      aria-describedby={live ? hint : undefined}
      onPointerDown={(e) => {
        if (!live || (e.pointerType === "mouse" && e.button !== 0)) return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        origin.current = { x: e.clientX, y: e.clientY }
        fire("press", { cue: "tap" })
        setHolding(true)
      }}
      onPointerMove={(e) => {
        const from = origin.current
        if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > MOVE_TOLERANCE) release()
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onClick={(e) => {
        if (e.detail === 0 && live) done()
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}
      className={cn(
        "relative isolate grid h-14 w-full select-none place-items-center overflow-hidden rounded-[14px] px-6 text-button font-semibold",
        live ? "bg-primary text-primary-foreground" : "cursor-not-allowed bg-input text-text-3",
        className,
      )}
    >
      <span>{holding ? holdingLabel : label}</span>
      {live ? (
        <motion.span
          aria-hidden
          style={{ clipPath }}
          className="absolute inset-0 grid place-items-center bg-shu px-6 text-black"
        >
          {holdingLabel}
        </motion.span>
      ) : null}
      <span id={hint} className="sr-only">
        Press and hold to confirm. Letting go early cancels.
      </span>
    </button>
  )
}
