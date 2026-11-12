"use client"

// The stage (plan 6.2): a lit vermilion field with soft light and fine grain, where real product objects float.
// Privy's "luminous interface stage", in seal ink. Used on sign-in, onboarding, the landing hero, the Home balance
// tile and the pay page header. It stays lit in dark mode.
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"

import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export function Stage({
  children,
  className,
  inner,
  grid = true,
  rounded = true,
}: {
  children?: React.ReactNode
  /** The field: size, padding, corners. */
  className?: string
  /** How the objects on the field are laid out (flex, grid, centring). */
  inner?: string
  /** A faint isometric lattice behind the objects. */
  grid?: boolean
  rounded?: boolean
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-stage text-white",
        rounded && "rounded-[24px]",
        className,
      )}
      style={{
        backgroundImage: [
          "radial-gradient(60% 55% at 16% 10%, var(--stage-hot) 0%, transparent 70%)",
          "radial-gradient(70% 60% at 55% 105%, var(--stage-glow) 0%, transparent 65%)",
          "radial-gradient(40% 40% at 92% 30%, #ff3a00 0%, transparent 70%)",
        ].join(","),
      }}
    >
      {/* Soft white light. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/4 h-72 w-96 rounded-full bg-white/14 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] bottom-[-20%] h-80 w-80 rounded-full bg-white/10 blur-3xl"
      />
      {grid ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(30deg, transparent 49.4%, #fff 49.6%, #fff 50.4%, transparent 50.6%), linear-gradient(150deg, transparent 49.4%, #fff 49.6%, #fff 50.4%, transparent 50.6%)",
            backgroundSize: "56px 32px",
            maskImage: "radial-gradient(70% 60% at 50% 60%, #000 0%, transparent 75%)",
          }}
        />
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
      <div className={cn("relative z-10 size-full", inner)}>{children}</div>
    </div>
  )
}

/**
 * A product object floating on the stage: enters on a spring, then drifts a few pixels on a slow loop.
 * Reduced motion: it simply appears and stays still.
 */
export function StageObject({
  children,
  className,
  delay = 0,
  drift = true,
  driftDelay = 0,
  from = { y: 24 },
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  drift?: boolean
  driftDelay?: number
  from?: { x?: number; y?: number; rotate?: number; scale?: number }
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={
        reduce
          ? { opacity: 0 }
          : {
              opacity: 0,
              x: from.x ?? 0,
              y: from.y ?? 0,
              rotate: from.rotate ?? 0,
              scale: from.scale ?? 1,
            }
      }
      animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
      transition={
        reduce ? { duration: 0.1 } : { type: "spring", stiffness: 420, damping: 40, delay }
      }
    >
      <div
        className={cn(drift && !reduce && "animate-drift")}
        style={{ animationDelay: `${driftDelay}s` }}
      >
        {children}
      </div>
    </motion.div>
  )
}

/** The white paper card objects are made of. */
export function Paper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[20px] bg-white text-black shadow-object", className)}>
      {children}
    </div>
  )
}

/** A white action circle with its label, for actions that sit on the stage (Home, a pay link). */
export function StageAction({
  label,
  icon,
  onClick,
  href,
  external,
}: {
  label: string
  icon: React.ReactNode
  onClick?: () => void
  href?: string
  external?: boolean
}) {
  const circle = (
    <>
      <span className="grid size-14 place-items-center rounded-full bg-white text-black shadow-object transition-transform group-active:scale-95 [&_svg]:size-6">
        {icon}
      </span>
      <span className="text-[14px] font-semibold text-white">{label}</span>
    </>
  )
  const cls = "group press flex w-16 flex-col items-center gap-2"
  if (href)
    return external ? (
      <a href={href} target="_blank" rel="noreferrer" className={cls} onClick={() => fire("tick")}>
        {circle}
      </a>
    ) : (
      <Link href={href} className={cls} onClick={() => fire("tick")}>
        {circle}
      </Link>
    )
  return (
    <button
      type="button"
      className={cls}
      onClick={() => {
        fire("tick")
        onClick?.()
      }}
    >
      {circle}
    </button>
  )
}
