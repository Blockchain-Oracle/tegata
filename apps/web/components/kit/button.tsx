"use client"

// 21st originui/button (143) on the Senryo spec: 56 high plates with 14 px corners (never a full pill inside the
// app), a 0.97 press, a spinner that replaces the label's leading icon while busy, and an optional cue.
import type { VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { forwardRef } from "react"

import { buttonVariants } from "@/components/kit/button-variants"
import { type Cue, fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  busy?: boolean
  /** A cue for a main action. Ticks and navigation stay silent. */
  cue?: Cue
}

export { buttonVariants }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      block,
      asChild = false,
      busy = false,
      cue,
      onClick,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot.Root : "button"
    return (
      <Comp
        ref={ref}
        aria-busy={busy || undefined}
        className={cn(
          buttonVariants({ variant, size, block }),
          busy && "pointer-events-none",
          className,
        )}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          if (cue) fire("press", { cue })
          onClick?.(e)
        }}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {busy ? <Spinner /> : null}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = "Button"

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4 animate-spin", className)} aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
