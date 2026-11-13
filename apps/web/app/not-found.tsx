// The 404 (audit top 10 #10; R6). Tegata is named after the old Japanese bill of exchange, so a link that leads
// nowhere is a bill that came back: a paper bill on the stage, numbered 404, stamped "Returned" in seal ink, with one
// way back. Every bad or expired pay, receipt, invoice, person or join link lands here; never Next's bare 404.
import type { Metadata } from "next"
import Link from "next/link"

import { TegataSeal } from "@/components/brand/seal"
import { Stage } from "@/components/kit/stage"

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-background">
      <Stage
        rounded={false}
        className="min-h-dvh"
        inner="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-14"
      >
        <div className="relative w-full max-w-[480px] -rotate-2">
          <div className="relative rounded-[18px] bg-paper text-[#16130F] shadow-object">
            <div className="flex items-center justify-between gap-3 px-6 pt-6">
              <span className="flex items-center gap-2.5">
                <TegataSeal size={34} tilt={-4} />
                <span className="text-[17px] font-bold">Tegata</span>
              </span>
              <span className="font-mono text-[13px] text-paper-text-3">Bill No. 404</span>
            </div>
            <div className="px-6 pt-5 pb-4">
              <span className="text-[13px] font-medium text-paper-text-3">Pay to the order of</span>
              <p className="display mt-1 text-[46px] leading-[1.0]">A page that isn't here</p>
            </div>
            {/* The tear line, like every Tegata slip. */}
            <div className="relative h-4" aria-hidden>
              <span className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-paper-rule" />
            </div>
            <div className="flex items-center gap-4 px-6 pt-2 pb-6">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium text-paper-text-3">Amount</span>
                  <span className="text-[15px] font-semibold">Nothing moved</span>
                </span>
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium text-paper-text-3">Why</span>
                  <span className="text-[15px] font-semibold">
                    It expired, or a letter went missing
                  </span>
                </span>
              </div>
              {/* The stamp: seal ink, pressed at an angle. */}
              <div
                aria-hidden
                className="shrink-0 rotate-[-12deg] rounded-[12px] border-[4px] border-shu px-4 py-2 text-shu"
                style={{ boxShadow: "inset 0 0 0 2px rgba(255,79,0,0.22)" }}
              >
                <span className="display block text-[30px] leading-none">Returned</span>
                <span className="block text-center text-[12px] font-bold">Not found</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full max-w-[480px] flex-col gap-3 sm:flex-row">
          <Link
            href="/app"
            className="press inline-flex h-14 flex-1 items-center justify-center rounded-[14px] bg-black text-[17px] font-semibold text-white hover:bg-black/85"
          >
            Open Tegata
          </Link>
          <Link
            href="/"
            className="press inline-flex h-14 flex-1 items-center justify-center rounded-[14px] bg-white/18 text-[17px] font-semibold text-white hover:bg-white/25"
          >
            Home
          </Link>
        </div>
      </Stage>
    </main>
  )
}
