"use client"

// A 56 px field on a quiet plate (Senryo's SheetInput spec): optional leading and trailing slots (a suffix like
// ".tegata.near", an inline arrow button), and a fixed-height status line that says what the field knows
// (Checking…, ✓ Available, or why not) so nothing jumps.
import { Check, X } from "lucide-react"
import { forwardRef } from "react"

import { Spinner } from "@/components/kit/button"
import { cn } from "@/lib/utils"

export type FieldStatus =
  | { kind: "none" }
  | { kind: "checking"; text?: string }
  | { kind: "ok"; text: string }
  | { kind: "bad"; text: string }

export const Field = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string
    leading?: React.ReactNode
    trailing?: React.ReactNode
    status?: FieldStatus
    /** Reserve the status line even when empty (forms whose status comes and goes). */
    reserveStatus?: boolean
    big?: boolean
  }
>(
  (
    {
      label,
      leading,
      trailing,
      status = { kind: "none" },
      reserveStatus = false,
      big = false,
      className,
      id,
      ...props
    },
    ref,
  ) => {
    const bad = status.kind === "bad"
    return (
      <div className="flex w-full flex-col gap-2">
        {label ? (
          <label htmlFor={id} className="text-detail font-medium text-muted-foreground">
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            "flex h-14 w-full items-center gap-2 rounded-[14px] bg-input px-4 transition-[box-shadow,background-color] duration-150 focus-within:bg-card focus-within:shadow-[0_0_0_2px_var(--shu)]",
            big && "h-16",
            bad && "shadow-[0_0_0_2px_var(--down)] focus-within:shadow-[0_0_0_2px_var(--down)]",
          )}
        >
          {leading}
          <input
            ref={ref}
            id={id}
            aria-invalid={bad || undefined}
            className={cn(
              "h-full min-w-0 flex-1 bg-transparent text-[17px] font-medium outline-none placeholder:text-text-3 focus-visible:outline-none",
              big && "text-[22px]",
              className,
            )}
            {...props}
          />
          {trailing}
        </div>
        {status.kind !== "none" || reserveStatus ? (
          <div className="flex h-5 items-center gap-1.5 text-detail" aria-live="polite">
            {status.kind === "checking" ? (
              <>
                <Spinner className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{status.text ?? "Checking…"}</span>
              </>
            ) : status.kind === "ok" ? (
              <>
                <Check className="size-4 text-up" strokeWidth={2.6} />
                <span className="font-medium text-up">{status.text}</span>
              </>
            ) : status.kind === "bad" ? (
              <>
                <X className="size-4 text-down" strokeWidth={2.6} />
                <span className="font-medium text-down">{status.text}</span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  },
)
Field.displayName = "Field"
