"use client"

// Checkout: a pay button for the business's own site. Choose the pay link it charges and how it looks; the stage
// shows the shop's page with the real button beside the checkout it opens, live, so what a customer sees is in view
// while you set it up (press the button and the same checkout opens over the page). Then the code to paste, in an
// editor: HTML, React, or a plain link that needs no script. Separate from its data so /dev/flows can show it.
import { Code2, ExternalLink, Link2, Plus, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/kit/button"
import { CodeEditor, type CodeFile } from "@/components/kit/code-editor"
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

const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/
const HEIGHT: Record<Size, number> = { s: 40, m: 48, l: 56 }

export function CheckoutView({
  links,
  error,
  onRetry,
  origin,
  sandbox,
  initialLink,
  demoSheet,
}: {
  links: PayLink[] | undefined
  error: boolean
  onRetry: () => void
  /** Where Tegata is served ("https://tegata.xyz"), for the code to paste. */
  origin: string
  sandbox: boolean
  /** Opened from a link's page: that link chosen. */
  initialLink?: string | null
  /** /dev: the sample pay page shown as the checkout, since sample links aren't real. */
  demoSheet?: string
}) {
  const open = useMemo(() => (links ?? []).filter((l) => l.status === "open"), [links])
  const [linkId, setLinkId] = useState<string | null>(initialLink ?? null)
  const link = open.find((l) => l.id === linkId) ?? open[0] ?? null
  const [typed, setTyped] = useState("")
  const [theme, setTheme] = useState<Theme>("shu")
  const [size, setSize] = useState<Size>("m")
  const [coins, setCoins] = useState(true)
  const [tab, setTab] = useState("html")
  const [overlay, setOverlay] = useState(false)
  const [here, setHere] = useState("")
  useEffect(() => setHere(window.location.origin), [])

  // The amount the button shows: the link's own, or (an any-amount link) what the shop sets.
  const fixed = link?.amount ? (Number(link.amount) / 1e6).toFixed(2) : null
  const amount = fixed ?? (AMOUNT.test(typed.trim()) ? typed.trim() : null)

  const query = new URLSearchParams({ theme, size })
  if (amount) query.set("amount", amount)
  if (!coins) query.set("coins", "0")
  const image = `/checkout/button.svg?${query}`

  /** The checkout this button opens: the real one for a real link, or /dev's sample. */
  const sheet = (withParent: boolean) => {
    if (demoSheet) return demoSheet
    if (!link) return null
    const q = new URLSearchParams()
    if (amount && !fixed) q.set("amount", amount)
    if (withParent && here) q.set("parent", here)
    const s = q.toString()
    return `/checkout/${link.token}${s ? `?${s}` : ""}`
  }

  const attrs = link
    ? [
        `data-tegata-link="${link.token}"`,
        amount ? `data-tegata-amount="${amount}"` : null,
        theme !== "shu" ? `data-tegata-theme="${theme}"` : null,
        size !== "m" ? `data-tegata-size="${size}"` : null,
        coins ? null : `data-tegata-coins="off"`,
      ].filter(Boolean)
    : []
  const files: CodeFile[] = link
    ? [
        {
          id: "html",
          name: "index.html",
          code: `<!-- Once per page -->\n<script src="${origin}/checkout.js" defer></script>\n\n<!-- Where the button goes -->\n<button ${attrs.join(" ")}></button>`,
        },
        {
          id: "react",
          name: "PayButton.tsx",
          code: `"use client"\n\nimport { useEffect } from "react"\n\nexport function PayButton() {\n  useEffect(() => {\n    const script = document.createElement("script")\n    script.src = "${origin}/checkout.js"\n    document.body.appendChild(script)\n  }, [])\n\n  return <button ${attrs.join(" ")} />\n}`,
        },
        {
          id: "link",
          name: "no-script.html",
          code: `<!-- No JavaScript: the same button, opening the pay page -->\n<a href="${origin}/pay/${link.token}${amount && !fixed ? `?amount=${amount}` : ""}">\n  <img src="${origin}${image}"\n       alt="Pay${amount ? ` $${amount}` : ""} with Tegata"\n       height="${HEIGHT[size]}">\n</a>`,
        },
      ]
    : []

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
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] xl:items-start">
            <section className="flex flex-col gap-5 rounded-[20px] bg-card p-5">
              <div className="flex flex-col gap-2">
                <span className="text-detail font-medium text-muted-foreground">
                  What it charges
                </span>
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
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["shu", "Vermilion", "bg-[#ff4f00]"],
                      ["ink", "Ink", "bg-[#16130f]"],
                      ["washi", "Washi", "bg-[#f3efe6] ring-1 ring-black/10"],
                    ] as const
                  ).map(([value, label, swatch]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        fire("tick", { cue: "toggle" })
                        setTheme(value)
                      }}
                      aria-pressed={theme === value}
                      className={cn(
                        "press flex flex-col items-center gap-2 rounded-[14px] px-2 py-3 text-[13px] font-semibold",
                        theme === value
                          ? "bg-secondary shadow-[0_0_0_2px_var(--shu)]"
                          : "bg-secondary/60",
                      )}
                    >
                      <span className={cn("h-6 w-12 rounded-[8px]", swatch)} />
                      {label}
                    </button>
                  ))}
                </div>
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

            <Stage className="p-4 sm:p-6">
              <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
                {/* A page like the shop's, with the real button on it. */}
                <div className="flex flex-col gap-3 lg:self-center">
                  <div
                    className={cn(
                      "flex flex-col gap-4 rounded-[18px] p-6 shadow-object",
                      theme === "washi" ? "bg-[#16130f] text-[#f3efe6]" : "bg-white text-black",
                    )}
                  >
                    <span className="text-[13px] font-semibold opacity-55">your-shop.com</span>
                    <span className="text-[22px] font-semibold leading-tight">{link.title}</span>
                    <button
                      type="button"
                      onClick={() => {
                        fire("press", { cue: "sheetOpen" })
                        setOverlay(true)
                      }}
                      className="press self-start"
                      aria-label={`Pay${amount ? ` $${amount}` : ""} with Tegata`}
                    >
                      <img
                        src={image}
                        alt=""
                        className="block w-auto"
                        style={{ height: HEIGHT[size] }}
                      />
                    </button>
                  </div>
                  <span className="text-[14px] font-medium text-white/90">
                    Press the button: this checkout opens over the page.
                  </span>
                </div>
                {/* What opens, live: the real checkout for this link (in /dev, the sample pay page). */}
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white/85">
                    What your customer sees
                  </span>
                  <div className="h-[560px] overflow-hidden rounded-[24px] bg-background shadow-object ring-1 ring-black/10">
                    {sheet(false) ? (
                      <iframe
                        key={sheet(false)}
                        src={sheet(false) ?? undefined}
                        title="The checkout this button opens"
                        className="size-full border-0"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </Stage>
          </div>

          <CodeEditor
            files={files}
            value={tab}
            onValueChange={setTab}
            footnote="Confirm each order from the signed webhook, never from the page."
          />

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

          {overlay ? (
            <SheetOverlay
              src={sheet(true)}
              ownClose={Boolean(demoSheet)}
              onClose={() => setOverlay(false)}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

/** The checkout over the page, exactly as checkout.js opens it on a shop: a sheet on a dimmed page. */
function SheetOverlay({
  src,
  ownClose,
  onClose,
}: {
  src: string | null
  /** The real checkout has its own close; the /dev sample needs one. */
  ownClose: boolean
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    // The checkout's own close button.
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === "tegata:checkout.close")
        onClose()
    }
    document.addEventListener("keydown", onKey)
    window.addEventListener("message", onMessage)
    return () => {
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("message", onMessage)
    }
  }, [onClose])
  if (!src) return null
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it (above); the click is the backdrop only.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pay with Tegata"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="relative h-[92dvh] w-full overflow-hidden rounded-t-[24px] bg-background shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:h-[min(780px,calc(100dvh-32px))] sm:w-[min(460px,calc(100vw-32px))] sm:rounded-[24px]">
        <iframe src={src} title="Pay with Tegata" className="size-full border-0" />
        {ownClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-secondary [&_svg]:size-4"
          >
            <X />
          </button>
        ) : null}
      </div>
    </div>
  )
}
