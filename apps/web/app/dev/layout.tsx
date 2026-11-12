import type { Metadata } from "next"
import { Suspense } from "react"

import { DevChrome } from "./dev-chrome"

// The review surface (plan 6.9): public so it can be opened on a phone, never indexed.
export const metadata: Metadata = {
  title: "Design review",
  robots: { index: false, follow: false },
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <DevChrome>{children}</DevChrome>
    </Suspense>
  )
}
