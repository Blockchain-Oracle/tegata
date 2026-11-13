"use client"

// 21st ddoemonn/task-steps (23569), from our earlier Senryo kit: a trace of named steps where the one in flight
// shimmers, a finished one pops a tick, and a failed one shows a cross. Tegata's version adds a real mark per row
// (NEAR, USDC) and plays the `step` cue as each step completes.
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"

import { Mark, type MarkId } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

export type TaskStep = {
  id: string
  label: string
  detail?: string
  mark?: MarkId
  icon?: React.ReactNode
}
export type TaskStepStatus = "pending" | "active" | "done" | "error"

const TWEEN = { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } as const

function statusOf(i: number, current: number, failed: boolean): TaskStepStatus {
  if (i < current) return "done"
  if (i === current) return failed ? "error" : "active"
  return "pending"
}

export function TaskSteps({
  steps,
  current,
  failed = false,
  sound = true,
  tone = "plate",
  className,
}: {
  steps: readonly TaskStep[]
  /** The step in flight; `steps.length` means all done. */
  current: number
  failed?: boolean
  sound?: boolean
  /** "plate" on the page; "paper" inside a white object on the stage. */
  tone?: "plate" | "paper"
  className?: string
}) {
  const reduced = useReducedMotion() === true
  const last = useRef(current)
  useEffect(() => {
    if (sound && current > last.current) fire("tick", { cue: "step" })
    last.current = current
  }, [current, sound])

  return (
    <ol aria-label="Progress" className={cn("flex w-full flex-col gap-1", className)}>
      {steps.map((step, i) => {
        const status = statusOf(i, current, failed)
        return (
          <li
            key={step.id}
            aria-current={status === "active" ? "step" : undefined}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors duration-200",
              status === "active" && (tone === "paper" ? "bg-[#F5F5F5]" : "bg-card"),
            )}
          >
            <span className="relative grid size-9 shrink-0 place-items-center">
              {step.mark ? (
                <Mark
                  id={step.mark}
                  size={32}
                  className={cn("transition-opacity", status === "pending" && "opacity-40")}
                />
              ) : (
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full bg-secondary text-foreground [&_svg]:size-4",
                    tone === "paper" && "bg-[#ECECEC] text-black",
                    status === "pending" && "opacity-40",
                  )}
                >
                  {step.icon}
                </span>
              )}
              <span className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center">
                <AnimatePresence initial={false}>
                  {status === "done" ? (
                    <motion.span
                      key="done"
                      className="grid size-[18px] place-items-center rounded-full bg-up text-white ring-2 ring-card"
                      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={
                        reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 26 }
                      }
                    >
                      <svg viewBox="0 0 16 16" className="size-2.5" fill="none" aria-hidden>
                        <path
                          d="M3.5 8.5l3 3 6-7"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </motion.span>
                  ) : status === "error" ? (
                    <motion.span
                      key="error"
                      className="grid size-[18px] place-items-center rounded-full bg-down text-white ring-2 ring-card"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={TWEEN}
                    >
                      <svg viewBox="0 0 16 16" className="size-2.5" fill="none" aria-hidden>
                        <path
                          d="M4.5 4.5l7 7M11.5 4.5l-7 7"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                        />
                      </svg>
                    </motion.span>
                  ) : status === "active" ? (
                    <motion.span
                      key="active"
                      className="grid size-[18px] place-items-center rounded-full bg-card ring-2 ring-card"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        className={cn("size-3.5 text-shu", !reduced && "animate-spin")}
                        aria-hidden
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="6"
                          fill="none"
                          stroke="currentColor"
                          strokeOpacity="0.25"
                          strokeWidth="2.4"
                        />
                        <path
                          d="M8 2a6 6 0 0 1 6 6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                        />
                      </svg>
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              {status === "active" && !reduced ? (
                <motion.span
                  className="truncate bg-[linear-gradient(90deg,var(--muted-foreground)_38%,var(--foreground)_50%,var(--muted-foreground)_62%)] bg-size-[220%_100%] bg-clip-text text-[16px] font-semibold text-transparent"
                  style={
                    tone === "paper"
                      ? { backgroundImage: "linear-gradient(90deg,#666 38%,#000 50%,#666 62%)" }
                      : undefined
                  }
                  animate={{ backgroundPosition: ["120% 0", "-120% 0"] }}
                  transition={{ duration: 1.6, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
                >
                  {step.label}
                </motion.span>
              ) : (
                <span
                  className={cn(
                    "truncate text-[16px] font-semibold transition-colors",
                    status === "pending" && "text-text-3",
                    status === "error" && "text-down",
                  )}
                >
                  {step.label}
                </span>
              )}
              {step.detail ? (
                <span className="truncate font-mono text-meta text-muted-foreground">
                  {step.detail}
                </span>
              ) : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
