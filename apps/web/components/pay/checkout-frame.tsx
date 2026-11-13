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

  // Escape closes it, as it does on the merchant's page (focus is inside this frame while the payer uses it).
  useEffect(() => {
    if (!parent || window.parent === window) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape")
        window.parent.postMessage({ type: "tegata:checkout.close", token }, parent)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [parent, token])

  return (
    <div className="min-h-dvh bg-background">
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-background/90 px-3 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => openPayWindow(token)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ExternalLink className="size-3.5" /> Open in a new window
        </button>
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

/**
 * The pay page in its own window, opened from the checkout frame: for a sign-in or a wallet that can't work inside
 * another site's frame. It keeps the amount the frame was given, and this frame as its opener: once a payment starts
 * there, it tells this frame (same origin only), which follows it and tells the merchant's page when it's paid.
 */
export function openPayWindow(token: string, path?: string) {
  const amount = new URLSearchParams(window.location.search).get("amount")
  const query = new URLSearchParams({ opener: "1" })
  if (amount) query.set("amount", amount)
  const url = path ?? `/pay/${token}?${query}`
  const opened = window.open(url, `tegata-pay-${token}`, "popup=yes,width=480,height=820")
  // A blocked popup: a plain new tab still lets them pay (the merchant's page then hears it from the webhook).
  if (!opened) window.open(url, "_blank")
}
