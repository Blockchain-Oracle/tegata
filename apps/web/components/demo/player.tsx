"use client"

// The film on /demo: YouTube plays it on the page (the no-cookie player, so nothing is set until Play), and the
// chapters beside it are links (/demo?t=67), so a moment can be shared and the player starts there.
import { ArrowUpRight, Play } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Stage } from "@/components/kit/stage"
import { CHAPTERS, DEMO_LENGTH, DEMO_VIDEO_ID } from "@/lib/demo"
import { fire } from "@/lib/feedback"
import { LINKS } from "@/lib/links"
import { cn } from "@/lib/utils"

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

export function DemoPlayer() {
  const asked = Number(useSearchParams().get("t"))
  const start = Number.isInteger(asked) && asked > 0 && asked < 135 ? asked : null
  const playing = CHAPTERS.findLast((chapter) => start !== null && chapter.at <= start)
  const src = `https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?rel=0${
    start === null ? "" : `&start=${start}&autoplay=1`
  }`
  return (
    <Stage
      tone="lacquer"
      className="rounded-[28px] p-3 sm:rounded-[32px] sm:p-5"
      inner="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6"
    >
      <figure className="flex min-w-0 flex-col gap-3">
        {/* YouTube refuses an embed that arrives without a referrer (error 153), so the page's origin is always sent. */}
        <iframe
          key={start ?? "start"}
          className="aspect-video w-full rounded-[18px] bg-black sm:rounded-[22px]"
          src={src}
          title="The Tegata demo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
        <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-[14px] text-white/70">
          <span>{DEMO_LENGTH} · recorded from the app on the Sandbox (NEAR testnet)</span>
          <a
            href={LINKS.demoVideo}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-white hover:underline"
          >
            Watch on YouTube <ArrowUpRight className="size-4" />
          </a>
        </figcaption>
      </figure>

      <nav aria-label="Chapters" className="flex min-w-0 flex-col">
        <span className="px-2 pb-2 font-mono text-[13px] text-white/55">Chapters</span>
        <ol className="flex flex-col">
          {CHAPTERS.map((chapter) => {
            const on = chapter === playing
            return (
              <li key={chapter.at}>
                <Link
                  href={`/demo?t=${chapter.at}#film`}
                  scroll={false}
                  replace
                  onClick={() => fire("tick")}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "group flex items-baseline gap-3 rounded-[12px] px-2 py-2 text-[15px] leading-snug transition-colors",
                    on
                      ? "bg-white/12 text-white"
                      : "text-white/80 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <span className="inline-flex w-[46px] shrink-0 items-center gap-1 font-mono text-[13px] text-[#ff8a52]">
                    {on ? <Play className="size-3 fill-current" /> : null}
                    {clock(chapter.at)}
                  </span>
                  <span>{chapter.label}</span>
                </Link>
              </li>
            )
          })}
        </ol>
      </nav>
    </Stage>
  )
}
