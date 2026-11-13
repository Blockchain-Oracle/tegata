"use client"

// The sign-in and onboarding frame: a form column on the page plate and a lit stage beside it, 16 px
// off the window. On a phone the stage becomes a band above the form.
import { Lockup } from "@/components/brand/seal"
import { Stage } from "@/components/kit/stage"
import { Mark } from "@/components/marks/mark"
import { cn } from "@/lib/utils"

export function AuthShell({
  children,
  stage,
  top,
  className,
}: {
  children: React.ReactNode
  stage: React.ReactNode
  /** Above the form on the left: a back button or a progress line. */
  top?: React.ReactNode
  className?: string
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row lg:p-4">
      <div className="order-2 flex flex-1 flex-col px-5 pb-6 sm:px-10 lg:order-1 lg:max-w-[560px] lg:px-14 lg:py-6">
        <div className="hidden h-12 items-center justify-between lg:flex">
          <Lockup size={34} />
          {top}
        </div>
        <div className="flex h-12 items-center lg:hidden">{top}</div>
        <div className={cn("flex flex-1 flex-col justify-center py-8 lg:py-12", className)}>
          {children}
        </div>
        <footer className="flex items-center gap-2 text-meta text-text-3">
          <span>Protected by Privy</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            Settled on <Mark id="near" size={16} /> NEAR
          </span>
        </footer>
      </div>
      <div className="relative order-1 p-3 pb-0 lg:order-2 lg:flex-1 lg:p-0">
        <Stage className="h-[460px] sm:h-[500px] lg:h-full lg:min-h-[640px]">
          <div className="absolute top-5 left-5 lg:hidden">
            <Lockup size={30} tone="paper" />
          </div>
          {stage}
        </Stage>
      </div>
    </div>
  )
}
