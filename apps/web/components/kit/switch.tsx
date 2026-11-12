"use client"

// 21st serafimcloud/switch (21948) on Senryo's spec: a 48×28 track, a 24 px thumb that slides in 100 ms, ink when on.
import { motion } from "motion/react"

import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        fire("tick", { cue: "toggle" })
        onCheckedChange(!checked)
      }}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors duration-150 disabled:opacity-40",
        checked ? "bg-primary" : "bg-plate-pressed",
        className,
      )}
    >
      <motion.span
        className={cn("block size-6 rounded-full", checked ? "bg-primary-foreground" : "bg-white")}
        animate={{ x: checked ? 20 : 0 }}
        transition={{ duration: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </button>
  )
}
