"use client"

// Light and dark (plan 6.2): a class on <html>, remembered on the device. The layout's inline script applies it before
// the first paint so nothing flashes; this hook reads and changes it. Replaces next-themes, whose client-rendered
// <script> React 19 warns about.
import { useSyncExternalStore } from "react"

export const THEME_KEY = "tegata.theme"
export type Theme = "light" | "dark"

const listeners = new Set<() => void>()

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // The choice holds for this page.
  }
  for (const l of listeners) l()
}

export function useTheme() {
  const resolvedTheme = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      const onStorage = (e: StorageEvent) => {
        if (e.key === THEME_KEY && e.newValue) setTheme(e.newValue as Theme)
      }
      window.addEventListener("storage", onStorage)
      return () => {
        listeners.delete(l)
        window.removeEventListener("storage", onStorage)
      }
    },
    current,
    () => "light" as Theme,
  )
  return { resolvedTheme, theme: resolvedTheme, setTheme }
}
