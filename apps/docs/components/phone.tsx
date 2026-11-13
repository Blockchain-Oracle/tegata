import type { ReactNode } from "react"

/*
 * A real screen from the app in a phone: a thin bezel round a rounded screen, a status bar holding the island so it
 * never covers the capture's own header. Fluid, so it takes its column's width from a phone to a wide screen.
 */

const FRAME = "linear-gradient(135deg, #2a2a2a 0%, #1c1c1c 45%, #151515 100%)"

export function Phone({
  src,
  alt,
  caption,
  eager = false,
  className = "",
}: {
  src: string
  alt: string
  caption?: ReactNode
  /** Above the fold: load at once instead of when scrolled near. */
  eager?: boolean
  className?: string
}) {
  return (
    <figure className={`not-prose m-0 flex flex-col items-center gap-3 ${className}`}>
      <div
        className="relative w-full max-w-[17rem] rounded-[3rem] p-[3.2%] shadow-[0_24px_60px_-18px_rgb(90_26_0/0.45),0_2px_6px_rgb(0_0_0/0.2)]"
        style={{ background: FRAME }}
      >
        <div className="relative overflow-hidden rounded-[2.6rem] bg-black">
          <div aria-hidden className="flex aspect-[100/11] items-center justify-center">
            <span className="h-[52%] w-[31%] rounded-full bg-[#050505] ring-1 ring-white/5" />
          </div>
          <img
            src={src}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="block aspect-[390/844] w-full object-cover object-top"
          />
        </div>
      </div>
      {caption ? (
        <figcaption className="max-w-[17rem] text-center text-[13px] leading-snug text-fd-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

/** Phones side by side; on a phone they scroll sideways instead of shrinking to nothing. */
export function Phones({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose -mx-4 my-8 overflow-x-auto px-4 [scrollbar-width:none]">
      <div className="grid min-w-[36rem] auto-cols-fr grid-flow-col gap-5 sm:min-w-0">
        {children}
      </div>
    </div>
  )
}

/** A wide capture of the app (desktop), framed like a window with its address. */
export function Shot({
  src,
  alt,
  caption,
  address = "tegata.xyz",
}: {
  src: string
  alt: string
  caption?: ReactNode
  address?: string
}) {
  return (
    <figure className="not-prose my-8">
      <div className="overflow-hidden rounded-[14px] border border-fd-border bg-black shadow-[0_18px_50px_-24px_rgb(0_0_0/0.5)]">
        <div className="flex h-7 items-center gap-1.5 border-b border-white/10 bg-[#161616] px-3">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="ms-3 truncate font-mono text-[11px] text-white/45">{address}</span>
        </div>
        <img src={src} alt={alt} loading="lazy" decoding="async" className="block h-auto w-full" />
      </div>
      {caption ? (
        <figcaption className="mt-3 text-center text-[13px] text-fd-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
