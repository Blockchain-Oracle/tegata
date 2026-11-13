"use client"

// Shared pieces of the landing's print grammar (DESIGN.md "The landing page"): a running head like a printed
// quarterly ("§ 03 · How a payment moves"), a title that rises once as it enters, and footnote markers whose
// sources sit at the foot of the section.
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

export function RunningHead({
  n,
  label,
  className,
  tone = "page",
}: {
  n: string
  label: string
  className?: string
  tone?: "page" | "night"
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t pt-3 font-mono text-[13px]",
        tone === "page" ? "border-rule text-text-3" : "border-white/15 text-white/55",
        className,
      )}
    >
      <span>
        § {n} · {label}
      </span>
      <span className="hidden sm:inline">Tegata · 手形</span>
    </div>
  )
}

/** Rises 12 px and fades in once, the first time it is on screen. Reduced motion: simply there. */
export function Rise({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  as?: "div" | "h2" | "p" | "li"
}) {
  const reduce = useReducedMotion()
  const M = motion[as]
  if (reduce) {
    const Tag = as
    return <Tag className={className}>{children}</Tag>
  }
  return (
    <M
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1], delay }}
    >
      {children}
    </M>
  )
}

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <Rise
      as="h2"
      className={cn(
        "display text-[clamp(44px,6.4vw,84px)] leading-[0.92] tracking-[-0.012em]",
        className,
      )}
    >
      {children}
    </Rise>
  )
}

/** A superscript note number that jumps to its source. */
export function Note({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 align-super text-[0.55em] font-semibold">
      <a href={`#note-${n}`} className="text-shu-ink hover:underline" aria-label={`Source ${n}`}>
        {n}
      </a>
    </sup>
  )
}
