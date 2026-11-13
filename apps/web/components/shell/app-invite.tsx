"use client"

// "Tegata on your phone" (S11, after Kawase's get-app card): a dismissable invite for signed-in people. On a laptop it is
// a small card floating at the bottom right with a QR to /download for the phone in your other hand; on a phone's
// browser it is a tile at the top of Home. Dismissed once, it stays dismissed on this device.
import { X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { TegataSeal } from "@/components/brand/seal"
import { buttonVariants } from "@/components/kit/button-variants"
import { DownloadQr } from "@/components/shell/download-qr"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

const KEY = "tegata.app-invite.dismissed"

export function AppInvite() {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    try {
      setShown(localStorage.getItem(KEY) !== "1")
    } catch {
      setShown(true)
    }
  }, [])
  const dismiss = () => {
    fire("tick", { cue: "sheetClose" })
    setShown(false)
    try {
      localStorage.setItem(KEY, "1")
    } catch {
      // Private mode: it comes back next visit.
    }
  }

  return (
    <AnimatePresence>
      {shown ? (
        <motion.aside
          key="app-invite"
          aria-label="Get Tegata on your phone"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 420, damping: 40 }}
          className={cn(
            "relative flex items-center gap-4 overflow-hidden rounded-[20px] bg-stage p-4 text-white",
            "lg:fixed lg:right-6 lg:bottom-6 lg:z-40 lg:w-[360px] lg:shadow-[0_8px_24px_#0003]",
          )}
          style={{
            backgroundImage:
              "radial-gradient(60% 80% at 10% 0%, var(--stage-hot) 0%, transparent 70%), radial-gradient(70% 70% at 70% 110%, var(--stage-glow) 0%, transparent 65%)",
          }}
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-[16px] bg-paper shadow-object">
            <TegataSeal size={40} tilt={-4} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-[17px] leading-tight font-semibold">Tegata on your phone</span>
            <span className="text-[14px] text-white/85">iPhone and Android · same email</span>
            <Link
              href="/download"
              onClick={() => fire("tick")}
              className={cn(
                buttonVariants({ variant: "paper", size: "sm" }),
                "self-start lg:hidden",
              )}
            >
              Get the app
            </Link>
            <Link
              href="/download"
              onClick={() => fire("tick")}
              className="hidden text-[14px] font-semibold text-white underline-offset-4 hover:underline lg:inline"
            >
              Or open tegata.xyz/download
            </Link>
          </span>
          <span className="hidden shrink-0 rounded-[12px] bg-paper p-1.5 lg:block" aria-hidden>
            <DownloadQr size={76} />
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="press absolute top-2 right-2 grid size-8 place-items-center rounded-full text-white/80 hover:bg-white/15 hover:text-white [&_svg]:size-4"
          >
            <X />
          </button>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
