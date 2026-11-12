// Emails (plan 6.8 K): the invoice and its reminders, built with react-email (sent by mailer.tsx through Resend). Plain,
// light, one button, the business's name first; Tegata only signs the footer. Sent only when Resend and a verified
// sender are configured (packages/env `emailConfigured`).
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

const SHU = "#FF4F00"
const GREY = "#666666"
const UNITS_PER_DOLLAR = 1e6

export const usd = (units: string) =>
  (Number(BigInt(units)) / UNITS_PER_DOLLAR).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
export const longDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
const day = longDay

export interface InvoiceEmailData {
  business: string
  customer: string
  number: string
  total: string
  remaining: string
  dueDate: string
  url: string
  notes: string | null
  sandbox: boolean
}

const font = "Archivo, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

function Frame({
  preview,
  children,
  business,
}: {
  preview: string
  children: React.ReactNode
  business: string
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{ backgroundColor: "#F5F5F5", fontFamily: font, margin: 0, padding: "32px 12px" }}
      >
        <Container
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            maxWidth: 520,
            padding: "32px 28px",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#000" }}>
            {business}
          </Text>
          {children}
          <Hr style={{ borderColor: "#ECECEC", margin: "28px 0 16px" }} />
          <Text style={{ fontSize: 12, color: GREY, margin: 0 }}>
            Sent with Tegata on behalf of {business}. Pay in dollars from any wallet; the payment
            settles in USDC on NEAR.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export function InvoiceEmail({ data }: { data: InvoiceEmailData }) {
  return (
    <Frame
      business={data.business}
      preview={`${data.number} for ${usd(data.total)}, due ${day(data.dueDate)}`}
    >
      <Text style={{ fontSize: 15, color: "#000", margin: "20px 0 4px" }}>Hi {data.customer},</Text>
      <Text style={{ fontSize: 15, color: "#000", margin: 0 }}>
        Here is invoice {data.number} from {data.business}.
      </Text>
      <Section
        style={{
          backgroundColor: "#F5F5F5",
          borderRadius: 14,
          padding: "18px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ fontSize: 13, color: GREY, margin: 0 }}>Amount due</Text>
        <Text
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: "#000",
            margin: "2px 0 6px",
            lineHeight: "1.1",
          }}
        >
          {usd(data.remaining)}
        </Text>
        <Text style={{ fontSize: 13, color: GREY, margin: 0 }}>Due {day(data.dueDate)}</Text>
      </Section>
      {data.notes ? (
        <Text style={{ fontSize: 14, color: "#444", whiteSpace: "pre-line" }}>{data.notes}</Text>
      ) : null}
      <Button
        href={data.url}
        style={{
          backgroundColor: SHU,
          color: "#FFFFFF",
          borderRadius: 14,
          padding: "14px 22px",
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        View and pay
      </Button>
      <Text style={{ fontSize: 13, color: GREY, margin: "14px 0 0" }}>
        The PDF is attached.
        {data.sandbox ? " This is a Sandbox invoice on NEAR testnet; no real money moves." : ""}
      </Text>
    </Frame>
  )
}

export function ReminderEmail({ data, offset }: { data: InvoiceEmailData; offset: number }) {
  const when =
    offset < 0
      ? `is due on ${day(data.dueDate)}`
      : offset === 0
        ? "is due today"
        : `was due on ${day(data.dueDate)}`
  return (
    <Frame business={data.business} preview={`A reminder: ${data.number} ${when}`}>
      <Text style={{ fontSize: 15, color: "#000", margin: "20px 0 4px" }}>Hi {data.customer},</Text>
      <Text style={{ fontSize: 15, color: "#000", margin: 0 }}>
        A friendly reminder that invoice {data.number} from {data.business} {when}.
      </Text>
      <Section
        style={{
          backgroundColor: "#F5F5F5",
          borderRadius: 14,
          padding: "18px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ fontSize: 13, color: GREY, margin: 0 }}>Left to pay</Text>
        <Text
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: "#000",
            margin: "2px 0 0",
            lineHeight: "1.1",
          }}
        >
          {usd(data.remaining)}
        </Text>
      </Section>
      <Button
        href={data.url}
        style={{
          backgroundColor: SHU,
          color: "#FFFFFF",
          borderRadius: 14,
          padding: "14px 22px",
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        View and pay
      </Button>
    </Frame>
  )
}
