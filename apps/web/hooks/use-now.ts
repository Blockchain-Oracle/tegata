"use client"

import { useEffect, useState } from "react"

const TICK_MS = 30_000

/**
 * The current time, ticking every `everyMs`. It is null on the server render and the first client render, so a
 * relative time ("pays in 7 min") never differs between the two and hydration stays clean.
 */
export function useNow(everyMs = TICK_MS): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}
