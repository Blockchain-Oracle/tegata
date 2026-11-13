// Magic UI "Bento Grid" (magicui.design/docs/components/bento-grid), reskinned to Tegata's landing tokens: washi
// plates without borders or group shadows, a lucide arrow, our link instead of shadcn's Button, and an optional
// status pill ("Opening soon") so a tile can be honest about what isn't switched on yet.
import { ArrowRight } from "lucide-react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"

import { cn } from "@/lib/utils"

interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode
  className?: string
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  name: string
  className?: string
  background: ReactNode
  description: string
  href: string
  cta: string
  pill?: string
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => (
  <div className={cn("grid w-full auto-rows-[22rem] grid-cols-3 gap-3", className)} {...props}>
    {children}
  </div>
)

const BentoCard = ({
  name,
  className,
  background,
  description,
  href,
  cta,
  pill,
  ...props
}: BentoCardProps) => (
  <div
    className={cn(
      "group relative col-span-3 flex transform-gpu lg:col-span-1 flex-col justify-between overflow-hidden rounded-[24px] bg-card",
      className,
    )}
    {...props}
  >
    <div className="absolute inset-0">{background}</div>
    <div className="relative mt-auto p-6">
      <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1.5 transition-all duration-300 lg:group-hover:-translate-y-9">
        <h3 className="flex items-center gap-2 text-[20px] leading-tight font-semibold">
          {name}
          {pill ? (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">
              {pill}
            </span>
          ) : null}
        </h3>
        <p className="max-w-[44ch] text-[15px] leading-[1.45] text-muted-foreground">
          {description}
        </p>
      </div>
      <a
        href={href}
        className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-semibold text-shu-ink lg:hidden"
      >
        {cta} <ArrowRight className="size-4" />
      </a>
    </div>
    <div className="pointer-events-none absolute bottom-0 hidden w-full translate-y-8 transform-gpu flex-row items-center p-6 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:flex">
      <a
        href={href}
        className="pointer-events-auto inline-flex items-center gap-1.5 text-[15px] font-semibold text-shu-ink hover:underline"
      >
        {cta} <ArrowRight className="size-4" />
      </a>
    </div>
    <div className="pointer-events-none absolute inset-0 transform-gpu transition-colors duration-300 group-hover:bg-foreground/[0.025]" />
  </div>
)

export { BentoCard, BentoGrid }
