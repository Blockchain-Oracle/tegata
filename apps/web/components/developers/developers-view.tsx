"use client"

// Developers (plan 6.8 Y): the quickstart, API keys (the full key shown once), webhook endpoints with their signing
// secret, a test event and Tegata's own test inbox, the delivery log with each payload, and the pay button snippet.
// Separate from its data so /dev/flows can show every state.
import { Check, Copy, Inbox, KeyRound, Plus, RotateCcw, Send, Trash2, Webhook } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Stage } from "@/components/kit/stage"
import { ErrorState, LoadingShape, StatusPill } from "@/components/kit/states"
import { Switch } from "@/components/kit/switch"
import { Sheet } from "@/components/shell/sheet"
import type { DevelopersView as Data } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { LINKS } from "@/lib/links"

const COPIED_MS = 1500

export function Code({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative rounded-[16px] bg-[#111] text-[#F5F5F5]">
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(text)
          fire("tick", { cue: "confirmed" })
          setCopied(true)
          setTimeout(() => setCopied(false), COPIED_MS)
        }}
        className="press absolute top-2 right-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[13px] font-semibold hover:bg-white/20 [&_svg]:size-3.5"
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto p-4 pr-24 font-mono text-[12.5px] leading-relaxed">
        {text}
      </pre>
    </div>
  )
}

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  return s < 60
    ? `${s}s ago`
    : s < 3600
      ? `${Math.round(s / 60)}m ago`
      : `${Math.round(s / 3600)}h ago`
}

export function DevelopersView({
  data,
  error,
  onRetry,
  busy,
  problem,
  newKey,
  onCreateKey,
  onCloseKey,
  onRevokeKey,
  onAddEndpoint,
  onAddInbox,
  onToggle,
  onDelete,
  onTest,
  onReveal,
  revealed,
  newSecret,
  onCloseSecret,
  onResend,
}: {
  data: Data | undefined
  error: boolean
  onRetry: () => void
  busy: boolean
  problem: string | null
  /** The key just made: shown once. */
  newKey: string | null
  onCreateKey: (name: string) => void
  onCloseKey: () => void
  onRevokeKey: (id: string) => void
  onAddEndpoint: (url: string) => void
  onAddInbox: () => void
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
  onTest: (id: string) => void
  onReveal: (id: string) => void
  revealed: Record<string, string>
  /** An endpoint's secret just made: shown once. */
  newSecret: string | null
  onCloseSecret: () => void
  onResend: (id: string) => void
}) {
  const [keyName, setKeyName] = useState("")
  const [url, setUrl] = useState("")
  const [creating, setCreating] = useState(false)
  if (error) return <ErrorState title="Couldn't load your developer settings" onRetry={onRetry} />
  if (!data)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="display text-page-title">Developers</h1>
        <LoadingShape shape="card" className="h-[200px] rounded-[24px]" />
        <LoadingShape shape="list" />
      </div>
    )

  const curl = `curl ${data.appUrl}/api/v1/checkout/sessions \\
  -H "Authorization: Bearer $TEGATA_KEY" \\
  -H "Idempotency-Key: order-1042" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": "25.00", "description": "Order #1042",
       "success_url": "https://your-shop.example/thanks",
       "metadata": {"order": "1042"}}'`
  const verify = `import { Webhook } from "standardwebhooks"

const wh = new Webhook(process.env.TEGATA_WEBHOOK_SECRET) // whsec_…
// In your handler, with the raw body as a string:
const event = wh.verify(rawBody, {
  "webhook-id": req.headers["webhook-id"],
  "webhook-timestamp": req.headers["webhook-timestamp"],
  "webhook-signature": req.headers["webhook-signature"],
})
if (event.type === "checkout.session.completed") fulfil(event.data.metadata.order)`
  const button = `<a href="${data.appUrl}/pay/YOUR_LINK_TOKEN"
   style="display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:14px;
          background:#FF4F00;color:#fff;font:600 16px system-ui;text-decoration:none">
  Pay with Tegata
</a>`
  const endpointUrl = (id: string) => data.endpoints.find((e) => e.id === id)?.url ?? ""

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="display text-page-title">Developers</h1>
        <p className="text-[15px] text-muted-foreground">
          Take payments from your own site: create a checkout session, send the payer to its page,
          and get a signed webhook when NEAR settles it. Sandbox keys work on testnet.{" "}
          <a
            href={`${LINKS.docs}/docs/build/developers`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-shu-ink underline-offset-[3px] hover:underline"
          >
            API and webhook docs ↗
          </a>
        </p>
      </header>

      <Stage className="p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <span className="text-[15px] font-semibold text-white">Create a checkout session</span>
          <Code text={curl} label="the curl command" />
          <span className="text-[14px] text-white/85">
            The response has a <code className="font-mono">url</code>: send your customer there.
            When it's paid you get <code className="font-mono">checkout.session.completed</code>.
          </span>
        </div>
      </Stage>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-section-title font-semibold">API keys</h2>
          <Button variant="shu" size="sm" onClick={() => setCreating(true)}>
            <Plus /> New key
          </Button>
        </div>
        {data.keys.length === 0 ? (
          <p className="rounded-[20px] bg-card px-4 py-5 text-[15px] text-muted-foreground">
            No keys yet. A key lets your server create checkout sessions.
          </p>
        ) : (
          <div className="flex flex-col rounded-[20px] bg-card p-2">
            {data.keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 rounded-[14px] px-3 py-3">
                <span className="grid size-10 place-items-center rounded-full bg-kin text-black [&_svg]:size-[18px]">
                  <KeyRound />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{k.name}</span>
                  <span className="truncate font-mono text-[12px] text-muted-foreground">
                    {k.prefix}… · {k.lastUsedAt ? `used ${ago(k.lastUsedAt)}` : "never used"}
                  </span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => onRevokeKey(k.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title font-semibold">Webhooks</h2>
        <div className="flex flex-col gap-2 rounded-[20px] bg-card p-3">
          {data.endpoints.map((e) => (
            <div key={e.id} className="flex flex-col gap-2 rounded-[14px] bg-secondary p-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sora text-black [&_svg]:size-4">
                  {e.inbox ? <Inbox /> : <Webhook />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-mono text-[13px]">{e.url}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {e.inbox ? "Tegata's test inbox · " : ""}secret {revealed[e.id] ?? e.secretHint}
                  </span>
                </span>
                <Switch
                  checked={e.enabled}
                  label={`Send to ${e.url}`}
                  onCheckedChange={(next) => onToggle(e.id, next)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="paper" size="sm" busy={busy} onClick={() => onTest(e.id)}>
                  <Send /> Send test event
                </Button>
                {revealed[e.id] ? null : (
                  <Button variant="paper" size="sm" onClick={() => onReveal(e.id)}>
                    Reveal secret
                  </Button>
                )}
                <Button variant="paper" size="sm" onClick={() => onDelete(e.id)}>
                  <Trash2 /> Remove
                </Button>
              </div>
            </div>
          ))}
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(ev) => {
              ev.preventDefault()
              if (url.trim()) onAddEndpoint(url.trim())
            }}
          >
            <Field
              id="endpoint-url"
              aria-label="Endpoint URL"
              placeholder="https://your-site.example/tegata/webhooks"
              value={url}
              onChange={(ev) => setUrl(ev.target.value)}
              className="font-mono"
            />
            <Button type="submit" size="md" busy={busy} disabled={!url.trim()}>
              Add endpoint
            </Button>
          </form>
          {data.endpoints.some((e) => e.inbox) ? null : (
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              busy={busy}
              onClick={onAddInbox}
            >
              <Inbox /> Use Tegata's test inbox
            </Button>
          )}
          {problem ? <p className="text-[14px] font-medium text-down">{problem}</p> : null}
          <p className="text-[13px] text-muted-foreground">
            Events: checkout.session.completed, payment.succeeded, payment.refunded, invoice.paid.
            Signed with Standard Webhooks; a non-2xx is retried at 30 s, 2 min, 10 min, 1 h and 6 h.
          </p>
        </div>
      </section>

      {data.inbox.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-section-title font-semibold">Test inbox</h2>
          <div className="flex flex-col rounded-[20px] bg-card p-2">
            {data.inbox.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                  {m.type ?? "unknown"}
                </span>
                <StatusPill tone={m.verified ? "up" : "down"}>
                  {m.verified ? "Signature valid" : "Bad signature"}
                </StatusPill>
                <span className="text-[12px] text-muted-foreground">{ago(m.receivedAt)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.deliveries.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-section-title font-semibold">Deliveries</h2>
          <div className="flex flex-col gap-1.5">
            {data.deliveries.map((d) => (
              <details key={d.id} className="rounded-[16px] bg-card px-3 py-2.5">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                    {d.type} → {endpointUrl(d.endpointId)}
                  </span>
                  <StatusPill
                    tone={d.status === "delivered" ? "up" : d.status === "failed" ? "down" : "wait"}
                  >
                    {d.status === "delivered"
                      ? `Delivered ${d.lastStatus ?? ""}`
                      : d.status === "failed"
                        ? "Failed"
                        : d.attempts
                          ? `Retrying (${d.attempts})`
                          : "Sending"}
                  </StatusPill>
                  <span className="text-[12px] text-muted-foreground">{ago(d.createdAt)}</span>
                </summary>
                <div className="mt-2 flex flex-col gap-2">
                  {d.lastError ? <p className="text-[13px] text-down">{d.lastError}</p> : null}
                  <Code text={d.payload} label="the payload" />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onClick={() => onResend(d.id)}
                  >
                    <RotateCcw /> Resend
                  </Button>
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title font-semibold">Verify a webhook (Node)</h2>
        <Code text={verify} label="the verification code" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title font-semibold">A pay button</h2>
        <p className="text-[15px] text-muted-foreground">
          For a fixed price, no server needed: point a button at one of your pay links.
        </p>
        <Code text={button} label="the button HTML" />
      </section>

      <Sheet
        open={creating || newKey !== null}
        onOpenChange={(o) => {
          if (o) return
          setCreating(false)
          onCloseKey()
        }}
        title="New API key"
      >
        {newKey ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] font-semibold">
              Copy it now: this is the only time it's shown.
            </p>
            <Code text={newKey} label="the key" />
            <Button
              onClick={() => {
                setCreating(false)
                onCloseKey()
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(ev) => {
              ev.preventDefault()
              onCreateKey(keyName)
            }}
          >
            <Field
              id="key-name"
              label="Name"
              placeholder="Shop server"
              value={keyName}
              onChange={(ev) => setKeyName(ev.target.value)}
            />
            <Button type="submit" busy={busy}>
              Create key
            </Button>
          </form>
        )}
      </Sheet>
      <Sheet
        open={newSecret !== null}
        onOpenChange={(o) => !o && onCloseSecret()}
        title="Signing secret"
      >
        <div className="flex flex-col gap-3">
          <p className="text-[15px]">
            Use it to check each webhook's signature. You can reveal it again on this page.
          </p>
          {newSecret ? <Code text={newSecret} label="the secret" /> : null}
          <Button onClick={onCloseSecret}>Done</Button>
        </div>
      </Sheet>
    </div>
  )
}
