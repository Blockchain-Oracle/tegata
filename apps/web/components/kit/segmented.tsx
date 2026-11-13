"use client"

// 21st ddoemonn/segmented-control (23552), from our earlier Kawase kit: a thumb that springs between options with the
// label clipped through it, arrow keys, and reading direction. Reskinned: a quiet plate track, an ink thumb, our type.
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"

import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

const CELL = { type: "spring", stiffness: 520, damping: 34, mass: 0.45 } as const
const SEG = "px-3.5 py-2 text-center text-[14px] font-semibold leading-[20px] whitespace-nowrap"

export type SegmentedOption = { value: string; label: string; disabled?: boolean }

export function Segmented({
  options,
  label,
  value,
  onValueChange,
  className,
}: {
  options: SegmentedOption[]
  label: string
  value: string
  onValueChange: (value: string) => void
  className?: string
}) {
  const count = Math.max(1, options.length)
  const template = `repeat(${count}, minmax(0, 1fr))`
  const found = options.findIndex((o) => o.value === value)
  const index = Math.max(found, 0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const reduced = useReducedMotion()
  const pos = useMotionValue(index)
  const thumbX = useTransform(pos, (v) => `${v * 100}%`)
  const maskX = useTransform(pos, (v) => `${v * -100}%`)
  const [hovered, setHovered] = useState(-1)

  useEffect(() => {
    if (reduced) {
      pos.set(index)
      return
    }
    const controls = animate(pos, index, CELL)
    return () => controls.stop()
  }, [index, reduced, pos])

  const select = useCallback(
    (next: string) => {
      if (next === value) return
      fire("tick")
      onValueChange(next)
    },
    [value, onValueChange],
  )

  const go = (i: number) => {
    const option = options[(i + count) % count]
    if (!option || option.disabled) return
    buttons.current[(i + count) % count]?.focus()
    select(option.value)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        // More options than the width holds: the track scrolls rather than squeezing labels over each other.
        "relative inline-block max-w-full select-none overflow-x-auto rounded-[12px] bg-secondary p-1 [scrollbar-width:none]",
        className,
      )}
    >
      <div
        className="relative grid min-w-max"
        style={{ gridTemplateColumns: template, touchAction: "manipulation" }}
      >
        {options.map((option, i) => (
          <span
            key={option.value}
            aria-hidden
            className={cn(
              SEG,
              "pointer-events-none",
              option.disabled
                ? "text-text-3/50"
                : hovered === i && i !== index
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {option.label}
          </span>
        ))}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 start-0 overflow-hidden rounded-[9px] bg-foreground"
          style={{ width: `${100 / count}%`, x: thumbX }}
          initial={false}
        >
          <motion.div className="absolute inset-0" style={{ x: maskX }} initial={false}>
            <div
              className="absolute inset-y-0 start-0 grid"
              style={{ width: `${count * 100}%`, gridTemplateColumns: template }}
            >
              {options.map((option) => (
                <span key={option.value} className={cn(SEG, "text-background")}>
                  {option.label}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: template }}
          onPointerLeave={() => setHovered(-1)}
        >
          {options.map((option, i) => (
            // biome-ignore lint/a11y/useSemanticElements: the 21st source's radiogroup pattern; a native radio can't carry the clipped thumb.
            <button
              key={option.value}
              ref={(node) => {
                buttons.current[i] = node
              }}
              type="button"
              role="radio"
              aria-checked={i === index}
              aria-disabled={option.disabled || undefined}
              tabIndex={i === index ? 0 : -1}
              onClick={() => !option.disabled && select(option.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault()
                  go(i + 1)
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault()
                  go(i - 1)
                }
              }}
              onPointerEnter={() => !option.disabled && setHovered(i)}
              className="rounded-[9px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="sr-only">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
