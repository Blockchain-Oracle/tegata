"use client"

// Aceternity UI "Sticky Scroll Reveal" (ui.aceternity.com/components/sticky-scroll-reveal), adapted for Tegata's
// landing: driven by the page's own scroll instead of an inner scroll box, the active step chosen by its position,
// our type and tokens, no gradient swaps, and on phones each step carries its own picture inline.
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react"
import type React from "react"
import { useRef, useState } from "react"

import { cn } from "@/lib/utils"

export interface StickyStep {
  title: string
  description: string
  content: React.ReactNode
}

export const StickyScroll = ({
  content,
  className,
  contentClassName,
}: {
  content: StickyStep[]
  className?: string
  contentClassName?: string
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 55%", "end 55%"] })

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const i = Math.min(content.length - 1, Math.max(0, Math.floor(latest * content.length)))
    setActive(i)
  })

  return (
    <div ref={ref} className={cn("relative grid gap-x-12 lg:grid-cols-[0.9fr_1.1fr]", className)}>
      <div>
        {content.map((item, index) => (
          <div
            key={item.title}
            className="flex flex-col justify-center gap-5 py-10 lg:min-h-[78vh] lg:py-16"
          >
            <motion.div
              animate={{ opacity: reduce || active === index ? 1 : 0.28 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4 max-lg:!opacity-100"
            >
              <span className="figure text-[56px] leading-none text-shu">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="display text-[clamp(36px,4.2vw,56px)] leading-[0.95]">{item.title}</h3>
              <p className="max-w-[44ch] text-[18px] leading-[1.5] text-muted-foreground">
                {item.description}
              </p>
            </motion.div>
            <div className="lg:hidden">{item.content}</div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <div
          className={cn(
            "sticky top-[12vh] h-[76vh] max-h-[720px] overflow-hidden rounded-[28px]",
            contentClassName,
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={active}
              className="absolute inset-0"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.02, y: -24 }}
              transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
            >
              {content[active]?.content ?? null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
