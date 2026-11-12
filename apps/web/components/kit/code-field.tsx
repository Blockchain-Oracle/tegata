"use client"

// The six-cell email code (21st ddoemonn/otp-input 23543 on `input-otp`): big cells on quiet plates, the active cell
// ringed in vermilion, paste and autofill through one hidden input. A wrong code shakes the row; an accepted code
// fills the cells vermilion one by one before the seal presses (plan 6.8 A).
import { OTPInput, type SlotProps } from "input-otp"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

export type CodeState = "idle" | "checking" | "wrong" | "accepted"

export function CodeField({
  value,
  onChange,
  onComplete,
  state = "idle",
  length = 6,
  autoFocus = true,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  state?: CodeState
  length?: number
  autoFocus?: boolean
  disabled?: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      key={state === "wrong" ? `wrong-${value}` : "steady"}
      animate={state === "wrong" && !reduce ? { x: [0, -6, 6, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <OTPInput
        value={value}
        onChange={(v) => onChange(v.replace(/\D/g, ""))}
        onComplete={onComplete}
        maxLength={length}
        autoFocus={autoFocus}
        disabled={disabled || state === "checking" || state === "accepted"}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Email code"
        containerClassName="flex items-center gap-2 sm:gap-2.5"
        render={({ slots }) => (
          <>
            {slots.map((slot, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the slots are positions in the code; position is their identity.
              <Cell key={i} {...slot} index={i} state={state} />
            ))}
          </>
        )}
      />
    </motion.div>
  )
}

function Cell({
  char,
  isActive,
  hasFakeCaret,
  index,
  state,
}: SlotProps & { index: number; state: CodeState }) {
  const reduce = useReducedMotion()
  const accepted = state === "accepted"
  return (
    <motion.div
      className={cn(
        "figure relative grid h-16 w-12 place-items-center rounded-[14px] bg-input text-[34px] transition-[box-shadow,background-color] duration-150 sm:h-[68px] sm:w-[52px]",
        isActive && state === "idle" && "bg-card shadow-[0_0_0_2px_var(--shu)]",
        state === "wrong" && "bg-down-surface text-down",
        state === "checking" && "opacity-70",
      )}
      animate={
        accepted
          ? { backgroundColor: "#FF4F00", color: "#000000", scale: reduce ? 1 : [1, 1.08, 1] }
          : {}
      }
      transition={{ delay: reduce ? 0 : index * 0.04, duration: 0.24 }}
    >
      {char}
      {hasFakeCaret ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="h-7 w-0.5 animate-caret-blink rounded-full bg-shu" />
        </span>
      ) : null}
    </motion.div>
  )
}
