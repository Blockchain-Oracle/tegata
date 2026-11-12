import type { ReactNode } from "react"

/*
 * Tegata's two signature pieces, the same as the app's: the 手形 seal (the app's own icon, glyph outlines from
 * Shippori Mincho B1) and the stage, a lit vermilion field with soft light where real objects sit.
 */

export function Seal({ size = 28, tilt = -4 }: { size?: number; tilt?: number }) {
  return (
    <img
      src="/seal.svg"
      alt="Tegata"
      width={size}
      height={size}
      className="shrink-0"
      style={{ transform: `rotate(${tilt}deg)` }}
    />
  )
}

/** The lit stage: base vermilion, a hot light upper left, a soft glow below, white light blurred on top. */
export function Stage({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={`stage relative isolate overflow-hidden rounded-[28px] text-white ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/4 h-72 w-96 rounded-full bg-white/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] bottom-[-20%] h-80 w-80 rounded-full bg-white/10 blur-3xl"
      />
      <div className="relative">{children}</div>
    </div>
  )
}
