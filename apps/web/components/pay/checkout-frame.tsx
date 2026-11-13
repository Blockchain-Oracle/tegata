"use client"

// The thin bar around the pay page when it opens over a merchant's site: close (tells the merchant's page to take
// the sheet away) and "Open in a new window" (for a sign-in or a wallet that won't work inside another site's frame).
// Messages go only to the merchant's own origin, as checkout.js gave it.
import { ExternalLink, X } from "lucide-react"
import { useEffect } from "react"

export function CheckoutFrame({
  token,
  parent,
  children,
}: {
  token: string
  parent: string | null
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!parent || window.parent === window) return
    window.parent.postMessage({ type: "tegata:checkout.opened", token }, parent)
  }, [parent, token])

  const close = () => {
    if (parent && window.parent !== window)
      window.parent.postMessage({ type: "tegata:checkout.close", token }, parent)
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-background/90 px-3 py-2 backdrop-blur">
        <a
          href={`/pay/${token}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ExternalLink className="size-3.5" /> Open in a new window
        </a>
        {parent ? (
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="press grid size-9 place-items-center rounded-full bg-secondary [&_svg]:size-4"
          >
            <X />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  )
}
