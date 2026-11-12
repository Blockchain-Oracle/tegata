import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

/*
 * A feature tile on the front page: a real capture of the app peeking up from the bottom in its phone frame; the
 * words lift on hover and a "Read" line rises into view.
 */

export function Tile({
  title,
  line,
  href,
  src,
  alt,
  field = "bg-fd-card",
  focus = "top",
  className = "",
}: {
  title: string
  line: string
  href: string
  src: string
  alt: string
  /** A story-field colour behind the phone (the app's own: sora, matcha, sakura, kin). */
  field?: string
  /** Which part of the capture shows through the frame (CSS object-position), e.g. "50% 62%". */
  focus?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`group relative flex min-h-[25rem] flex-col overflow-hidden rounded-[24px] border border-fd-border bg-fd-card transition-[border-color,box-shadow] duration-300 hover:shadow-[0_20px_50px_-30px_rgb(90_26_0/0.5)] ${className}`}
    >
      <div className="relative z-10 flex flex-col gap-1.5 p-6 transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <h3 className="display text-[1.7rem] leading-none">{title}</h3>
        <p className="max-w-[34ch] text-[14.5px] leading-snug text-fd-muted-foreground">{line}</p>
        <span className="mt-1 inline-flex translate-y-1 items-center gap-1 text-[13px] font-semibold text-shu-ink opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          Read <ArrowUpRight className="size-3.5" />
        </span>
      </div>
      <div
        className={`relative mx-4 mt-auto flex h-[15rem] justify-center overflow-hidden rounded-t-[20px] ${field}`}
      >
        <div className="absolute top-6 w-[60%] max-w-[14rem] translate-y-4 rounded-t-[2.2rem] bg-[#1c1c1c] p-[2.6%] pb-0 shadow-[0_-10px_40px_-18px_rgb(0_0_0/0.5)] transition-transform duration-500 ease-out group-hover:translate-y-0">
          <div className="overflow-hidden rounded-t-[1.9rem] bg-black pt-[9%]">
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              // A shorter box than the screen, so `focus` picks which slice of the capture shows.
              className="block aspect-[390/600] w-full object-cover"
              style={{ objectPosition: focus }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
