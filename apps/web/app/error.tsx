"use client"

// When a page fails to render (audit top 10 #10; R7: say what still works, offer one action): the stage, the seal,
// one line, and Try again. Money is never moved by a page render, so nothing was lost; the technical text stays in
// the console, not on the page.
import Link from "next/link"
import { useEffect } from "react"

import { TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Paper, Stage } from "@/components/kit/stage"

export default function ErrorPage({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main className="min-h-dvh bg-background">
      <Stage
        rounded={false}
        className="min-h-dvh"
        inner="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12"
      >
        <Paper className="flex w-full max-w-[400px] flex-col items-center gap-5 px-6 py-10 text-center">
          <TegataSeal size={88} tilt={-6} />
          <div className="flex flex-col gap-2">
            <h1 className="display text-[40px] leading-none">This page didn't load</h1>
            <p className="text-[15px] text-paper-text-2">Your money is where it was.</p>
          </div>
          <Button
            size="lg"
            cue="tap"
            onClick={() => retry()}
            className="w-full bg-black text-white hover:bg-black/85"
          >
            Try again
          </Button>
          <Link
            href="/"
            className="text-[15px] font-semibold text-paper-seal underline-offset-2 hover:underline"
          >
            Go to Tegata
          </Link>
        </Paper>
      </Stage>
    </main>
  )
}
