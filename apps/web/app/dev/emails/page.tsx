"use client"

// Every email Tegata sends, rendered with the real layout and words (/dev shows every part). Sample data
// lives in lib/dev/sample.ts.
import type { EmailEvent } from "@tegata/documents"
import { useEffect, useState } from "react"

import { EMAIL_SAMPLES } from "@/lib/dev/sample"

export default function EmailsGallery() {
  const [rendered, setRendered] = useState<
    { subject: string; html: string; kind: string; key: string }[]
  >([])
  useEffect(() => {
    let live = true
    void import("@tegata/documents/preview").then(async ({ emailHtml }) => {
      const out = []
      for (const sample of EMAIL_SAMPLES) {
        const { subject, html } = await emailHtml(
          sample as unknown as EmailEvent,
          window.location.origin,
        )
        out.push({ subject, html, kind: sample.kind, key: `${sample.kind}:${out.length}` })
      }
      if (live) setRendered(out)
    })
    return () => {
      live = false
    }
  }, [])
  return (
    <div className="flex flex-col gap-8 pt-6">
      <div className="flex flex-col gap-1">
        <span className="display text-[30px]">Emails</span>
        <p className="text-[15px] text-muted-foreground">
          {EMAIL_SAMPLES.length} samples of the {"~30"} kinds Tegata sends: a slip for money that
          moved, a card for everything else. Same layout as the inbox gets.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {rendered.map((email) => (
          <figure key={email.key} className="flex flex-col gap-2">
            <figcaption className="flex flex-col">
              <span className="font-mono text-[12px] text-muted-foreground">{email.kind}</span>
              <span className="text-[15px] font-semibold">{email.subject}</span>
            </figcaption>
            <iframe
              title={email.subject}
              srcDoc={email.html}
              className="h-[760px] w-full rounded-[20px] bg-[#F5F5F5] shadow-object"
            />
          </figure>
        ))}
      </div>
    </div>
  )
}
