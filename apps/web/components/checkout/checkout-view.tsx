"use client"

// Checkout: a pay button for the business's own site. Choose the pay link it charges and how it looks; the stage
// shows the real button on a page like the shop's (press it and the real checkout opens over it), then the code to
// paste: HTML, React, or a plain link that needs no script. Separate from its data so /dev/flows can show it.
import { Check, Code2, Copy, ExternalLink, Link2, Plus } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { SandboxPill } from "@/components/kit/sandbox-pill"
import { Segmented } from "@/components/kit/segmented"
import { Stage } from "@/components/kit/stage"
import { EmptyState, ErrorState, LoadingShape } from "@/components/kit/states"
import { Switch } from "@/components/kit/switch"
import type { PayLink } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { usdUnits } from "@/lib/fiat"
import { cn } from "@/lib/utils"

type Theme = "shu" | "ink" | "washi"
type Size = "s" | "m" | "l"
type Tab = "html" | "react" | "link"

const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/
const COPIED_MS = 1500

declare global {
  interface Window {
    Tegata?: { checkout: (options: Record<string, unknown>) => void; close: () => void }
  }
}

export function CheckoutView({
  links,
  error,
  onRetry,
  origin,
  sandbox,
  initialLink,
  canPreview = true,
}: {
  links: PayLink[] | undefined
  error: boolean
  onRetry: () => void
  /** Where Tegata is served ("https://tegata.xyz"), for the code to paste. */
  origin: string
  sandbox: boolean
  /** Opened from a link's page: that link chosen. */
  initialLink?: string | null
  /** False on /dev, where the links are samples: the button shows the look but opens nothing. */
  canPreview?: boolean
}) {
  const open = useMemo(() => (links ?? []).filter((l) => l.status === "open"), [links])
  const [linkId, setLinkId] = useState<string | null>(initialLink ?? null)
  const link = open.find((l) => l.id === linkId) ?? open[0] ?? null
  const [typed, setTyped] = useState("")
  const [theme, setTheme] = useState<Theme>("shu")
  const [size, setSize] = useState<Size>("m")
  const [coins, setCoins] = useState(true)
  const [tab, setTab] = useState<Tab>("html")
  const [copied, setCopied] = useState(false)

  // The real embed script, so the preview opens the real checkout.
  useEffect(() => {
    if (document.querySelector("script[data-tegata-preview]")) return
    const script = document.createElement("script")
    script.src = "/checkout.js"
    script.defer = true
    script.dataset.tegataPreview = "1"
    document.body.appendChild(script)
  }, [])

  // The amount the button shows: the link's own, or (an any-amount link) what the shop sets.
  const fixed = link?.amount ? (Number(link.amount) / 1e6).toFixed(2) : null
  const amount = fixed ?? (AMOUNT.test(typed.trim()) ? typed.trim() : null)

  const query = new URLSearchParams({ theme, size })
  if (amount) query.set("amount", amount)
  if (!coins) query.set("coins", "0")
  const image = `/checkout/button.svg?${query}`

  const attrs = link
    ? [
        `data-tegata-link="${link.token}"`,
        amount ? `data-tegata-amount="${amount}"` : null,
        theme !== "shu" ? `data-tegata-theme="${theme}"` : null,
        size !== "m" ? `data-tegata-size="${size}"` : null,
        coins ? null : `data-tegata-coins="off"`,
      ].filter(Boolean)
    : []
  const code = !link
    ? ""
    : tab === "html"
      ? `<script src="${origin}/checkout.js" defer></script>\n\n<button ${attrs.join(" ")}></button>`
      : tab === "react"
        ? `import { useEffect } from "react"\n\nexport function PayButton() {\n  useEffect(() => {\n    const script = document.createElement("script")\n    script.src = "${origin}/checkout.js"\n    document.body.appendChild(script)\n  }, [])\n  return <button ${attrs.join(" ")} />\n}`
        : `<a href="${origin}/pay/${link.token}${amount && !fixed ? `?amount=${amount}` : ""}">\n  <img src="${origin}${image}"\n       alt="Pay${amount ? ` $${amount}` : ""} with Tegata" height="${size === "s" ? 40 : size === "l" ? 56 : 48}">\n</a>`

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }

  const preview = () => {
    if (!link || !canPreview) return
    fire("tick")
    window.Tegata?.checkout({ link: link.token, amount: fixed ? undefined : (amount ?? undefined) })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="display text-page-title">Checkout</h1>
          <p className="text-[15px] text-muted-foreground">
            A pay button for your own site. Customers pay from any wallet, on any chain.
          </p>
        </div>
        {sandbox ? <SandboxPill>Sandbox · other chains pay in Live</SandboxPill> : null}
      </header>

      {error ? (
        <ErrorState
          title="Couldn't load your pay links"
          detail="Buttons already on your site still work."
          onRetry={onRetry}
        />
      ) : links === undefined ? (
        <LoadingShape shape="card" className="h-[320px] rounded-[24px]" />
      ) : !link ? (
        <EmptyState
          art={<Link2 />}
          field="sora"
          title="A button charges a pay link"
          detail="Make a pay link first: a fixed price, or any amount your shop sets."
          action={
            <Button variant="shu" asChild>
              <Link href="/app/links?new=1">
                <Plus /> New pay link
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <section className="flex flex-col gap-5 rounded-[20px] bg-card p-5">
            <div className="flex flex-col gap-2">
              <span className="text-detail font-medium text-muted-foreground">What it charges</span>
              <div className="flex flex-col gap-1">
                {open.slice(0, 6).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      fire("tick")
                      setLinkId(l.id)
                    }}
                    aria-pressed={l.id === link.id}
                    className={cn(
                      "press flex items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-left",
                      l.id === link.id
                        ? "bg-secondary shadow-[0_0_0_2px_var(--shu)]"
                        : "hover:bg-secondary",
                    )}
                  >
                    <span className="min-w-0 truncate text-[15px] font-semibold">{l.title}</span>
                    <span className="tnum shrink-0 text-[15px] text-muted-foreground">
                      {l.amount ? usdUnits(l.amount) : "Any amount"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {fixed ? null : (
              <Field
                id="button-amount"
                label="Amount on the button"
                inputMode="decimal"
                placeholder="42.50"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            )}

            <div className="flex flex-col gap-2">
              <span className="text-detail font-medium text-muted-foreground">Look</span>
              <Segmented
                label="Button colour"
                value={theme}
                onValueChange={(v) => setTheme(v as Theme)}
                options={[
                  { value: "shu", label: "Vermilion" },
                  { value: "ink", label: "Ink" },
                  { value: "washi", label: "Washi" },
                ]}
              />
              <Segmented
                label="Button size"
                value={size}
                onValueChange={(v) => setSize(v as Size)}
                options={[
                  { value: "s", label: "Small" },
                  { value: "m", label: "Medium" },
                  { value: "l", label: "Large" },
                ]}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[15px] font-semibold">Show the coins</span>
              <Switch checked={coins} onCheckedChange={setCoins} label="Show the coins" />
            </div>
          </section>

          <div className="flex flex-col gap-4">
            <Stage className="p-5 sm:p-7">
              {/* A page like the shop's, with the real button on it. */}
              <div
                className={cn(
                  "flex flex-col gap-4 rounded-[18px] p-6 shadow-object",
                  theme === "washi" ? "bg-[#16130f] text-[#f3efe6]" : "bg-white text-black",
                )}
              >
                <span className="text-[13px] font-semibold opacity-60">your-shop.com</span>
                <span className="text-[22px] font-semibold leading-tight">{link.title}</span>
                <button
                  type="button"
                  onClick={preview}
                  className="press self-start"
                  aria-label={`Pay${amount ? ` $${amount}` : ""} with Tegata`}
                >
                  <img
                    src={image}
                    alt=""
                    className="block w-auto"
                    style={{ height: size === "s" ? 40 : size === "l" ? 56 : 48 }}
                  />
                </button>
              </div>
              <span className="mt-3 block text-[14px] font-medium text-white/85">
                {canPreview
                  ? "Press it: this is the real checkout."
                  : "Sample links: on your Checkout page, pressing it opens the real checkout."}
              </span>
            </Stage>

            <section className="flex flex-col gap-3 rounded-[20px] bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <Segmented
                  label="Code"
                  value={tab}
                  onValueChange={(v) => setTab(v as Tab)}
                  options={[
                    { value: "html", label: "HTML" },
                    { value: "react", label: "React" },
                    { value: "link", label: "No script" },
                  ]}
                  className="max-w-[320px]"
                />
                <Button variant="secondary" size="sm" onClick={() => void copy()}>
                  {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-[14px] bg-secondary p-4 font-mono text-[13px] leading-relaxed">
                {code}
              </pre>
              <span className="text-detail text-muted-foreground">
                Confirm each order from the signed webhook, never from the page.
              </span>
            </section>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href="/app/developers">
                  <Code2 /> Your server sets the price: checkout sessions
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <a href={`/pay/${link.token}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open the pay page
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
