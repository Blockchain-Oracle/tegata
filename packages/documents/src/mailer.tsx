/** @jsxRuntime automatic */
/** @jsxImportSource react */
// Sends Tegata's emails through Resend: any `EmailEvent`, composed by the catalog and rendered with the one layout,
// as HTML and plain text. Server only (the worker). The idempotency key is the outbox row's id, so a retry never sends
// twice. Customer and payroll emails go out as "<Business> via Tegata" and replies reach the business.
import { render } from "@react-email/render"
import { Resend } from "resend"

import { compose, type EmailEvent } from "./email/catalog.ts"
import { type EmailContent, TegataEmail } from "./email/layout.tsx"

export interface Attachment {
  filename: string
  content: Buffer
}

export interface Mailer {
  deliver(
    event: EmailEvent,
    options: { to: string; key: string; replyTo?: string | null; attachments?: Attachment[] },
  ): Promise<string>
}

/** The email as it will arrive: subject, HTML and the plain-text part. */
export async function renderEmail(event: EmailEvent, assets: string) {
  const content: EmailContent = compose(event, assets)
  const element = <TegataEmail content={content} />
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
  return { content, subject: content.subject, html, text }
}

/** `Tegata <receipts@…>` → the address alone. */
const addressOf = (from: string) => from.match(/<([^>]+)>/)?.[1] ?? from.trim()
const displayName = (name: string) => name.replace(/["<>\r\n]/g, "").slice(0, 60)

export function resendMailer(apiKey: string, from: string, assets: string): Mailer {
  const resend = new Resend(apiKey)
  const address = addressOf(from)
  return {
    async deliver(event, { to, key, replyTo, attachments }) {
      const { content, subject, html, text } = await renderEmail(event, assets)
      const sender =
        content.audience === "owner"
          ? from
          : `${displayName(content.business)} via Tegata <${address}>`
      const { data, error } = await resend.emails.send(
        {
          from: sender,
          to,
          subject,
          html,
          text,
          ...(replyTo ? { replyTo } : {}),
          ...(attachments?.length ? { attachments } : {}),
        },
        { idempotencyKey: `tegata-${key}` },
      )
      if (error || !data) throw new Error(`Resend: ${error?.message ?? "no response"}`)
      return data.id
    },
  }
}
