"use client"

// Where to go after signing in or opening an account. A payer who signs in from a pay link comes back to it instead
// of landing in the app. Kept for this tab only, and only ever a path on this site.
const KEY = "tegata.next"

const safe = (path: string | null): path is string =>
  Boolean(path?.startsWith("/") && !path.startsWith("//"))

export function rememberNext(path: string): void {
  if (!safe(path)) return
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    // Storage blocked: the person lands on Home and can reopen the link.
  }
}

/** The remembered path (once), or the fallback. */
export function takeNext(fallback = "/app"): string {
  try {
    const path = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (safe(path)) return path
  } catch {
    // Storage blocked.
  }
  return fallback
}
