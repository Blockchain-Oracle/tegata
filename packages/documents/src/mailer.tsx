// Sends the emails in emails.tsx through Resend. Server only (the worker); the browser only previews templates.
import { Resend } from "resend"

import { InvoiceEmail, type InvoiceEmailData, longDay, ReminderEmail, usd } from "./emails.tsx"

export interface Mailer {
  invoice(input: { to: string; data: InvoiceEmailData; pdf: Buffer; key: string }): Promise<string>
  reminder(input: {
    to: string
    data: InvoiceEmailData
    offset: number
    key: string
  }): Promise<string>
}

/** A Resend mailer. `key` is the idempotency key, so a retried job never sends twice. */
export function resendMailer(apiKey: string, from: string): Mailer {
  const resend = new Resend(apiKey)
  const send = async (
    payload: {
      to: string
      subject: string
      react: React.ReactElement
      attachments?: { filename: string; content: Buffer }[]
    },
    key: string,
  ) => {
    const { data, error } = await resend.emails.send({ from, ...payload }, { idempotencyKey: key })
    if (error || !data) throw new Error(`Resend: ${error?.message ?? "no response"}`)
    return data.id
  }
  return {
    invoice: ({ to, data, pdf, key }) =>
      send(
        {
          to,
          subject: `${data.number} from ${data.business}: ${usd(data.remaining)} due ${longDay(data.dueDate)}`,
          react: <InvoiceEmail data={data} />,
          attachments: [{ filename: `${data.number}.pdf`, content: pdf }],
        },
        key,
      ),
    reminder: ({ to, data, offset, key }) =>
      send(
        {
          to,
          subject: `Reminder: ${data.number} from ${data.business}, ${usd(data.remaining)}`,
          react: <ReminderEmail data={data} offset={offset} />,
        },
        key,
      ),
  }
}
