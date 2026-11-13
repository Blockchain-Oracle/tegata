/** @jsxRuntime automatic */
/** @jsxImportSource react */
// One layout for every Tegata email, so no email can drift. Two shapes:
// the slip, for money that moved (the receipt page on paper: header, hero figure, the seal pressed, a perforation,
// receipt rows, the NEAR transaction), and the card, for everything else (a vermilion rule, a headline, a few lines).
// Tables and inline styles only, light only, a black main button (DESIGN.md: the one main action is black; vermilion is
// the seal's colour), pictures as PNG by URL (mail clients drop SVG), and a plain-text part rendered from the same tree.
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components"

export interface EmailRow {
  label: string
  value: string
  href?: string
  mono?: boolean
  /** A mark id from public/email/marks (usdc, near, intents, tron…), or "tegata" for the seal. */
  mark?: string
  /** A round flag from public/email/flags (ng, gh, za, eu, us…), for money in a local currency. */
  flag?: string
}

/** The picture beside a row's value: its flag, the Tegata seal, or a real mark. */
function rowPicture(row: EmailRow, assets: string): string | null {
  if (row.flag) return `${assets}/email/flags/${row.flag}.png`
  if (row.mark === "tegata") return `${assets}/email/seal.png`
  if (row.mark) return `${assets}/email/marks/${row.mark}.png`
  return null
}

export interface EmailContent {
  shape: "slip" | "card"
  subject: string
  /** The inbox preview line. */
  preview: string
  /** Who the email is from, in its header: the business (with its logo when it has one) or Tegata. */
  brand: { name: string; logo?: string | null }
  /** Small line above the hero, e.g. "You got paid" or "Receipt · No. 12". */
  label: string
  /** The one hero: a money figure on a slip, a short headline on a card. */
  hero: string
  /** Money in is green with a plus; money out is ink with a minus; a headline is plain. */
  tone?: "in" | "out" | "plain"
  /** Under the hero, e.g. "USDC on NEAR · Sandbox". */
  sub?: string | null
  /** The seal pressed on the slip, with its word ("Paid", "Sent", "Refunded", "Payslip"). */
  stamp?: string | null
  body?: string[]
  rows?: EmailRow[]
  button?: { label: string; href: string } | null
  links?: { label: string; href: string }[]
  /** Who it goes to decides the footer: an owner, a customer or payer, a paid person, or Tegata's own. */
  audience: "owner" | "customer" | "person"
  /** The business behind it (footers name it). */
  business: string
  sandbox: boolean
  /** Where public/email lives (the app's URL). */
  assets: string
}

/** Data keeps app paths ("/r/…"); the email needs absolute links. */
const abs = (assets: string, href: string) => (href.startsWith("/") ? `${assets}${href}` : href)

const INK = "#000000"
const GREY = "#666666"
const PAPER = "#F5F5F5"
const RULE = "#ECECEC"
const UP = "#2F7A00"
const SHU = "#FF4F00"
const SEAL_INK = "#B23700"
const TEXT = "Archivo, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
const FIGURE = "Archivo, 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
const MONO = "'DM Mono', ui-monospace, Menlo, Consolas, monospace"

const FOOTER: Record<EmailContent["audience"], (business: string) => string> = {
  owner: (business) =>
    `You get this because you run ${business} on Tegata. Change which emails you get in Business → Emails. Tegata never asks you to sign or approve anything by email.`,
  customer: (business) =>
    `Sent with Tegata on behalf of ${business}. Pay in dollars from any wallet or exchange; payments settle in USDC on NEAR.`,
  person: (business) =>
    `Sent with Tegata on behalf of ${business}. Tegata never asks you to sign or approve anything by email.`,
}

function Brand({ content }: { content: EmailContent }) {
  return (
    <Row>
      <Column style={{ width: 32, verticalAlign: "middle" }}>
        <Img
          src={
            content.brand.logo
              ? abs(content.assets, content.brand.logo)
              : `${content.assets}/email/seal.png`
          }
          width="24"
          height="24"
          alt=""
          style={{ borderRadius: content.brand.logo ? 12 : 5, display: "block" }}
        />
      </Column>
      <Column style={{ verticalAlign: "middle" }}>
        <Text style={{ margin: 0, fontFamily: TEXT, fontSize: 15, fontWeight: 700, color: INK }}>
          {content.brand.name}
        </Text>
      </Column>
    </Row>
  )
}

function Figure({ content }: { content: EmailContent }) {
  const sign = content.tone === "in" ? "+" : content.tone === "out" ? "−" : ""
  return (
    <Text
      style={{
        margin: "6px 0 0",
        fontFamily: FIGURE,
        fontSize: 46,
        lineHeight: "1.05",
        fontWeight: 900,
        fontStretch: "62%",
        letterSpacing: "-0.01em",
        color: content.tone === "in" ? UP : INK,
      }}
    >
      {sign}
      {content.hero}
    </Text>
  )
}

function Rows({ rows, assets }: { rows: EmailRow[]; assets: string }) {
  return (
    <Section>
      {rows.map((row) => {
        const picture = rowPicture(row, assets)
        return (
          <Row key={`${row.label}:${row.value}`} style={{ margin: 0 }}>
            <Column style={{ padding: "6px 0", verticalAlign: "top" }}>
              <Text style={{ margin: 0, fontFamily: TEXT, fontSize: 14, color: GREY }}>
                {row.label}
              </Text>
            </Column>
            <Column align="right" style={{ padding: "6px 0", verticalAlign: "top" }}>
              <Text
                style={{
                  margin: 0,
                  fontFamily: row.mono ? MONO : TEXT,
                  fontSize: row.mono ? 13 : 14,
                  fontWeight: 600,
                  color: INK,
                  // Only an account or hash may break anywhere; words wrap between words.
                  ...(row.mono
                    ? { wordBreak: "break-all" as const }
                    : { overflowWrap: "break-word" as const }),
                }}
              >
                {picture ? (
                  <Img
                    src={picture}
                    width="16"
                    height="16"
                    alt=""
                    style={{
                      display: "inline-block",
                      verticalAlign: "-3px",
                      marginRight: 6,
                      borderRadius: row.mark === "tegata" ? 4 : 8,
                    }}
                  />
                ) : null}
                {row.href ? (
                  <Link
                    href={abs(assets, row.href)}
                    style={{ color: SEAL_INK, textDecoration: "none" }}
                  >
                    {row.value}
                  </Link>
                ) : (
                  row.value
                )}
              </Text>
            </Column>
          </Row>
        )
      })}
    </Section>
  )
}

function Perforation() {
  return (
    <Row>
      <Column style={{ width: 10 }}>
        <div
          style={{ width: 10, height: 20, borderRadius: "0 10px 10px 0", backgroundColor: SHU }}
        />
      </Column>
      <Column>
        <div style={{ borderTop: "2px dashed #E2E2E2", height: 0, margin: "0 6px" }} />
      </Column>
      <Column style={{ width: 10 }}>
        <div
          style={{ width: 10, height: 20, borderRadius: "10px 0 0 10px", backgroundColor: SHU }}
        />
      </Column>
    </Row>
  )
}

function Main({ content }: { content: EmailContent }) {
  return (
    <>
      {content.body?.map((line) => (
        <Text
          key={line}
          style={{
            margin: "0 0 12px",
            fontFamily: TEXT,
            fontSize: 15,
            lineHeight: "1.5",
            color: INK,
          }}
        >
          {line}
        </Text>
      ))}
      {content.button ? (
        <Button
          href={abs(content.assets, content.button.href)}
          style={{
            backgroundColor: INK,
            color: "#FFFFFF",
            borderRadius: 12,
            padding: "15px 22px",
            fontFamily: TEXT,
            fontSize: 15,
            fontWeight: 600,
            marginTop: 8,
          }}
        >
          {content.button.label}
        </Button>
      ) : null}
      {content.links?.length ? (
        <Text style={{ margin: "14px 0 0", fontFamily: TEXT, fontSize: 14 }}>
          {content.links.map((link, i) => (
            <span key={link.href}>
              {i > 0 ? "  ·  " : ""}
              <Link
                href={abs(content.assets, link.href)}
                style={{ color: SEAL_INK, fontWeight: 600, textDecoration: "none" }}
              >
                {link.label}
              </Link>
            </span>
          ))}
        </Text>
      ) : null}
    </>
  )
}

export function TegataEmail({ content }: { content: EmailContent }) {
  const slip = content.shape === "slip"
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..100,400..900&family=DM+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>{content.preview}</Preview>
      <Body style={{ backgroundColor: PAPER, margin: 0, padding: "28px 10px" }}>
        <Container style={{ maxWidth: slip ? 480 : 540 }}>
          {/* The stage: Tegata's lit vermilion field, with the paper slip (or card) floating on it. */}
          <Section
            style={{
              backgroundColor: SHU,
              backgroundImage:
                "radial-gradient(circle at 18% 0%, #FF7A2E 0%, rgba(255,122,46,0) 55%), radial-gradient(circle at 60% 100%, #FFB38A 0%, rgba(255,179,138,0) 60%)",
              borderRadius: 28,
              padding: "20px 16px 16px",
            }}
          >
            <Row style={{ marginBottom: 14 }}>
              <Column style={{ width: 36, verticalAlign: "middle", paddingLeft: 6 }}>
                <Img
                  src={`${content.assets}/email/seal-paper.png`}
                  width="28"
                  height="28"
                  alt="Tegata"
                  style={{ display: "block", borderRadius: 6 }}
                />
              </Column>
              <Column style={{ verticalAlign: "middle" }}>
                <Text
                  style={{
                    margin: 0,
                    fontFamily: FIGURE,
                    fontSize: 20,
                    fontWeight: 900,
                    fontStretch: "62%",
                    color: "#FFFFFF",
                  }}
                >
                  Tegata
                </Text>
              </Column>
              {content.sandbox ? (
                <Column align="right" style={{ verticalAlign: "middle", paddingRight: 6 }}>
                  <Text
                    style={{
                      display: "inline-block",
                      margin: 0,
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1.5px dashed rgba(255,255,255,0.85)",
                      fontFamily: TEXT,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#FFFFFF",
                    }}
                  >
                    Sandbox
                  </Text>
                </Column>
              ) : null}
            </Row>
            <Section
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                boxShadow: "0 10px 28px rgba(80,20,0,0.22)",
                overflow: "hidden",
              }}
            >
              <Section style={{ padding: "24px 26px 18px" }}>
                <Brand content={content} />
                <Row>
                  <Column style={{ verticalAlign: "top", paddingTop: 18 }}>
                    <Text
                      style={{
                        margin: 0,
                        fontFamily: TEXT,
                        fontSize: 14,
                        fontWeight: 600,
                        color: GREY,
                      }}
                    >
                      {content.label}
                    </Text>
                    {slip ? (
                      <Figure content={content} />
                    ) : (
                      <Text
                        style={{
                          margin: "6px 0 0",
                          fontFamily: TEXT,
                          fontSize: 26,
                          lineHeight: "1.2",
                          fontWeight: 800,
                          letterSpacing: "-0.01em",
                          color: INK,
                        }}
                      >
                        {content.hero}
                      </Text>
                    )}
                    {content.sub ? (
                      <Text
                        style={{
                          margin: "6px 0 0",
                          fontFamily: TEXT,
                          fontSize: 14,
                          fontWeight: 500,
                          color: GREY,
                        }}
                      >
                        {content.sub}
                      </Text>
                    ) : null}
                  </Column>
                  {slip && content.stamp ? (
                    <Column
                      align="right"
                      style={{ width: 96, verticalAlign: "top", paddingTop: 10 }}
                    >
                      <Img
                        src={`${content.assets}/email/stamp.png`}
                        width="84"
                        height="84"
                        alt=""
                      />
                      <Text
                        style={{
                          margin: "2px 0 0",
                          fontFamily: TEXT,
                          fontSize: 12,
                          fontWeight: 700,
                          color: SEAL_INK,
                          textAlign: "center",
                        }}
                      >
                        {content.stamp}
                      </Text>
                    </Column>
                  ) : null}
                </Row>
              </Section>
              {slip && content.rows?.length ? (
                <>
                  <Perforation />
                  <Section style={{ padding: "12px 26px 6px" }}>
                    <Rows rows={content.rows} assets={content.assets} />
                  </Section>
                </>
              ) : content.rows?.length ? (
                <Section style={{ padding: "0 26px 6px" }}>
                  <Rows rows={content.rows} assets={content.assets} />
                </Section>
              ) : null}
              <Section style={{ padding: "10px 26px 24px" }}>
                <Main content={content} />
              </Section>
              {slip ? (
                <Section style={{ borderTop: `1px solid ${RULE}`, padding: "12px 26px" }}>
                  <Text
                    style={{
                      margin: 0,
                      fontFamily: TEXT,
                      fontSize: 12,
                      fontWeight: 500,
                      color: GREY,
                    }}
                  >
                    <Img
                      src={`${content.assets}/email/marks/near.png`}
                      width="14"
                      height="14"
                      alt=""
                      style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 5 }}
                    />
                    Settled on NEAR{"   ·   "}
                    <Img
                      src={`${content.assets}/email/marks/circle.png`}
                      width="14"
                      height="14"
                      alt=""
                      style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 5 }}
                    />
                    USDC by Circle
                  </Text>
                </Section>
              ) : null}
            </Section>
          </Section>
          <Text
            style={{
              margin: "18px 8px 0",
              fontFamily: TEXT,
              fontSize: 12,
              lineHeight: "1.5",
              color: GREY,
            }}
          >
            {FOOTER[content.audience](content.business)}
            {content.sandbox ? " Sandbox: NEAR testnet, no real money moved." : ""}
          </Text>
          <Text style={{ margin: "6px 8px 0", fontFamily: TEXT, fontSize: 12, color: GREY }}>
            <Link href={content.assets} style={{ color: GREY }}>
              Tegata
            </Link>
            {" · Get paid and pay your people in dollars, from any chain, on NEAR."}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
