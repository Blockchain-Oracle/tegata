"use client"

// "Tegata on your phone" in the landing's bottom-right corner, for someone meeting Tegata for the first time. It waits
// until the hero has scrolled away, steps aside when the closing section's own call to open an account comes up, and
// closing it keeps it closed for the visit. On a laptop it is a paper slip with the code to /download for the phone in
// your other hand; on a phone there is nothing to scan, so it is a small pill that opens /download, which offers what
// that phone installs (TestFlight on an iPhone, the APK on Android).
import { ArrowRight, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { TegataSeal } from "@/components/brand/seal"
import { DownloadQr } from "@/components/shell/download-qr"
import { fire } from "@/lib/feedback"

const KEY = "tegata.app-corner.closed"
/** Shown once the page has scrolled this many window heights: past the hero and its seal. */
const SHOW_AFTER = 0.8
/** Hidden again once the closing section (id "open") is this far up the window. */
const HIDE_AT = 0.9

function closedThisVisit(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function AppCorner() {
  const reduce = useReducedMotion()
  const [closed, setClosed] = useState(true)
  const [inPlace, setInPlace] = useState(false)

  useEffect(() => {
    if (closedThisVisit()) return
    setClosed(false)
    const check = () => {
      const open =
        document.getElementById("open")?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
      setInPlace(
        window.scrollY > window.innerHeight * SHOW_AFTER && open > window.innerHeight * HIDE_AT,
      )
    }
    check()
    window.addEventListener("scroll", check, { passive: true })
    window.addEventListener("resize", check)
    return () => {
      window.removeEventListener("scroll", check)
      window.removeEventListener("resize", check)
    }
  }, [])

  const close = () => {
    fire("tick", { cue: "sheetClose" })
    setClosed(true)
    try {
      sessionStorage.setItem(KEY, "1")
    } catch {
      // Private mode: closed for this page view only.
    }
  }

  const enter = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : {
        initial: { opacity: 0, y: 24, rotate: 1.5 },
        animate: { opacity: 1, y: 0, rotate: 0 },
        exit: { opacity: 0, y: 16 },
        transition: { type: "spring" as const, stiffness: 380, damping: 32 },
      }

  return (
    <AnimatePresence>
      {inPlace && !closed ? (
        <motion.aside
          key="app-corner"
          aria-label="Get Tegata on your phone"
          {...enter}
          className="fixed right-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 text-[#16130f] lg:right-6 lg:bottom-6"
        >
          {/* A laptop: the code, for the phone in your other hand. */}
          <div className="relative hidden w-[348px] items-center gap-4 rounded-[20px] border border-paper-rule bg-paper p-3 pe-6 shadow-object lg:flex">
            <span className="shrink-0 rounded-[14px] border border-paper-rule bg-paper p-2">
              <DownloadQr size={92} />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[16px] leading-tight font-semibold">Tegata on your phone</span>
              <span className="text-[13px] leading-snug text-paper-text-2">
                Point your phone&apos;s camera at the code.
              </span>
              <Link
                href="/download"
                onClick={() => fire("tick")}
                className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-paper-seal underline-offset-4 hover:underline [&_svg]:size-3.5"
              >
                iPhone and Android <ArrowRight />
              </Link>
            </span>
            <CloseButton onClose={close} />
          </div>

          {/* A phone: nothing to scan, so one tap to /download. */}
          <div className="flex items-center gap-1 rounded-full border border-paper-rule bg-paper p-1.5 shadow-object lg:hidden">
            <Link
              href="/download"
              onClick={() => fire("tick")}
              className="press flex items-center gap-2.5 rounded-full pe-2"
            >
              <span className="grid size-10 place-items-center rounded-full bg-paper-sunk">
                <TegataSeal size={28} tilt={-4} />
              </span>
              <span className="flex flex-col">
                <span className="text-[15px] leading-tight font-semibold">Get the app</span>
                <span className="text-[12px] text-paper-text-2">iPhone and Android</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="press grid size-9 place-items-center rounded-full text-paper-text-2 hover:bg-paper-sunk [&_svg]:size-4"
            >
              <X />
            </button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="press absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full text-paper-text-2 hover:bg-paper-sunk [&_svg]:size-3.5"
    >
      <X />
    </button>
  )
}
