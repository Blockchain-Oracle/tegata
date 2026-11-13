"use client"

// Magic UI "Text Reveal" (magicui.design/docs/components/text-reveal), reskinned for Tegata: words ink in as you
// scroll, in the condensed display cut, on the page's own tokens; the pinned height is a prop.

import { type MotionValue, motion, useScroll, useTransform } from "motion/react"
import { type ComponentPropsWithoutRef, type FC, type ReactNode, useRef } from "react"

import { cn } from "@/lib/utils"

export interface TextRevealProps extends ComponentPropsWithoutRef<"div"> {
  children: string
}

export const TextReveal: FC<TextRevealProps> = ({ children, className }) => {
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
  })

  if (typeof children !== "string") {
    throw new Error("TextReveal: children must be a string")
  }

  const words = children.split(" ")

  return (
    <div ref={sectionRef} className={cn("relative z-0 h-[200vh]", className)}>
      <div
        className={
          "sticky top-0 mx-auto flex h-screen max-w-[1240px] items-center bg-transparent px-5 sm:px-8"
        }
      >
        <span
          className={
            "display flex flex-wrap text-[clamp(52px,9vw,128px)] leading-[0.9] text-foreground/15"
          }
        >
          {words.map((word, i) => {
            const start = i / words.length
            const end = start + 1 / words.length
            return (
              <Word key={i} progress={scrollYProgress} range={[start, end]}>
                {word}
              </Word>
            )
          })}
        </span>
      </div>
    </div>
  )
}

interface WordProps {
  children: ReactNode
  progress: MotionValue<number>
  range: [number, number]
}

const Word: FC<WordProps> = ({ children, progress, range }) => {
  const opacity = useTransform(progress, range, [0, 1])
  return (
    <span className="relative mr-[0.22em]">
      <span className="absolute opacity-30">{children}</span>
      <motion.span style={{ opacity: opacity }} className="text-foreground">
        {children}
      </motion.span>
    </span>
  )
}
