"use client"

// The stage: a lit field with soft light and fine grain, where real product objects float. Two tones (DESIGN.md
// palette): `shu`, the vermilion field for money moments (the balance, the pay page header, a receipt), and
// `lacquer`, sumi black lit by a vermilion glow rising from below with the landing's dot grid, for big surfaces
// (sign-in, onboarding, cards, bank). Both stay lit in dark mode; `paid` turns the field green for money arrived.
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"

import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

/** The field's lights. The stage is light in both themes, so these are fixed colours, not theme tokens. */
const LIGHTS = {
  shu: {
    base: "var(--stage)",
    hot: "var(--stage-hot)",
    glow: "var(--stage-glow)",
    edge: "#ff3a00",
  },
  paid: { base: "#2F7A00", hot: "#4FA81C", glow: "#8FD94E", edge: "#236000" },
} as const

export function Stage({
  children,
  className,
  inner,
  grid = true,
  rounded = true,
  tone = "shu",
}: {
  children?: React.ReactNode
  /** The field: size, padding, corners. */
  className?: string
  /** How the objects on the field are laid out (flex, grid, centring). */
  inner?: string
  /** A faint isometric lattice behind the objects. */
  grid?: boolean
  rounded?: boolean
  /** `paid` lights the field green for money that has arrived (the counter's paid moment). */
  tone?: "shu" | "paid" | "lacquer"
}) {
  if (tone === "lacquer")
    return (
      <Lacquer className={className} inner={inner} rounded={rounded} grid={grid}>
        {children}
      </Lacquer>
    )
  const light = LIGHTS[tone]
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden text-white transition-[background-color] duration-300",
        tone === "shu" && "bg-stage",
        rounded && "rounded-[24px]",
        className,
      )}
      style={{
        backgroundColor: tone === "shu" ? undefined : light.base,
        backgroundImage: [
          `radial-gradient(60% 55% at 16% 10%, ${light.hot} 0%, transparent 70%)`,
          `radial-gradient(70% 60% at 55% 105%, ${light.glow} 0%, transparent 65%)`,
          `radial-gradient(40% 40% at 92% 30%, ${light.edge} 0%, transparent 70%)`,
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

/** Sumi lit from below: the landing hero's night, as a stage. */
function Lacquer({
  children,
  className,
  inner,
  rounded,
  grid,
}: {
  children?: React.ReactNode
  className?: string
  inner?: string
  rounded: boolean
  grid: boolean
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-[#120D0A] text-white",
        rounded && "rounded-[24px]",
        className,
      )}
    >
      {/* The light: one vermilion glow rising behind the objects, a warm rim at the top. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[45%] left-1/2 aspect-square w-[150%] max-w-[1400px] -translate-x-1/2 rounded-full opacity-90 blur-[70px]"
        style={{
          background:
            "radial-gradient(closest-side, #FF4F00 0%, #FF6A1A 30%, rgba(255,122,46,0.45) 52%, rgba(255,79,0,0.12) 72%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 -left-1/4 aspect-square w-[70%] rounded-full opacity-30 blur-[90px]"
        style={{ background: "radial-gradient(closest-side, #FF7A2E, transparent 70%)" }}
      />
      {grid ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.2px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(85% 75% at 50% 45%, #000 0%, transparent 80%)",
          }}
        />
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
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
    <div className={cn("rounded-[20px] bg-paper text-[#16130F] shadow-object", className)}>
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
