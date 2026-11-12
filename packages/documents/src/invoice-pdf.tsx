/** @jsxRuntime automatic */
/** @jsxImportSource react */
// The invoice as an A4 PDF (plan 6.8 J–N): the same document the customer sees on the web, for the email attachment
// and "Download PDF". Drawn with @react-pdf/renderer on the server; fonts are embedded (see fonts.ts).
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import { archivo400, archivo600, archivo800, mono400 } from "./fonts.ts"

Font.register({
  family: "Archivo",
  fonts: [
    { src: archivo400, fontWeight: 400 },
    { src: archivo600, fontWeight: 600 },
    { src: archivo800, fontWeight: 800 },
  ],
})
Font.register({ family: "DM Mono", src: mono400 })
// Never split a word across lines on an invoice.
Font.registerHyphenationCallback((word) => [word])

const SHU = "#FF4F00"
const INK = "#000000"
const GREY = "#666666"
const RULE = "#ECECEC"
const UNITS_PER_DOLLAR = 1e6

export interface PdfParty {
  name: string
  email: string | null
  address: string | null
  taxId: string | null
}

export interface InvoiceDocument {
  number: string
  status: "open" | "paid" | "void"
  from: PdfParty
  to: PdfParty | null
  /** A PNG or JPEG data URL, or null (a monogram seal stands in). */
  logo: string | null
  issueDate: string
  dueDate: string
  lines: { description: string; quantity: string; unitPrice: string; amount: string }[]
  subtotal: string
  discount: string
  discountLabel: string | null
  tax: string
  taxLabel: string | null
  total: string
  paidTotal: string
  remaining: string
  notes: string | null
  payUrl: string
  payAddress: string
  sandbox: boolean
}

const usd = (units: string) =>
  (Number(BigInt(units)) / UNITS_PER_DOLLAR).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })

const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`
      : (words[0]?.slice(0, 2) ?? "")
  ).toUpperCase()
}

const s = StyleSheet.create({
  page: { fontFamily: "Archivo", fontSize: 10, color: INK, padding: 44, lineHeight: 1.4 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 8.5, fontWeight: 600, color: GREY, marginBottom: 3 },
  seal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: SHU,
    alignItems: "center",
    justifyContent: "center",
  },
  th: { fontSize: 8.5, fontWeight: 600, color: GREY },
  td: { paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: RULE },
})

function PartyBlock({ party }: { party: PdfParty }) {
  return (
    <View>
      <Text style={{ fontWeight: 600 }}>{party.name}</Text>
      {party.address ? <Text style={{ color: "#444" }}>{party.address}</Text> : null}
      {party.taxId ? <Text style={{ color: "#444" }}>Tax ID {party.taxId}</Text> : null}
      {party.email ? <Text style={{ color: "#444" }}>{party.email}</Text> : null}
    </View>
  )
}

function Stamp({ name }: { name: string }) {
  return (
    <View
      style={{
        width: 92,
        height: 92,
        borderRadius: 46,
        borderWidth: 4,
        borderColor: SHU,
        alignItems: "center",
        justifyContent: "center",
        transform: "rotate(-8deg)",
      }}
    >
      <Text style={{ fontSize: 7, fontWeight: 800, color: SHU, letterSpacing: 1 }}>
        {name.toUpperCase().slice(0, 18)}
      </Text>
      <View
        style={{
          backgroundColor: SHU,
          paddingHorizontal: 10,
          paddingVertical: 3,
          marginVertical: 4,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF", letterSpacing: 1.5 }}>
          PAID
        </Text>
      </View>
      <Text style={{ fontSize: 7, fontWeight: 800, color: SHU, letterSpacing: 1 }}>TEGATA</Text>
    </View>
  )
}

export function InvoicePdf({ doc }: { doc: InvoiceDocument }) {
  const paid = BigInt(doc.paidTotal)
  return (
    <Document title={`${doc.number} from ${doc.from.name}`} author={doc.from.name} creator="Tegata">
      <Page size="A4" style={s.page}>
        {doc.status === "void" ? (
          <View style={{ backgroundColor: "#C8283F", padding: 6, marginBottom: 14 }}>
            <Text style={{ color: "#FFFFFF", fontWeight: 600, textAlign: "center" }}>
              This invoice was cancelled
            </Text>
          </View>
        ) : null}

        <View style={[s.between, { alignItems: "flex-start" }]}>
          <View style={[s.row, { alignItems: "center", gap: 10 }]}>
            {doc.logo ? (
              <Image
                src={doc.logo}
                style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }}
              />
            ) : (
              <View style={s.seal}>
                <Text style={{ fontSize: 13, fontWeight: 800, color: SHU }}>
                  {monogram(doc.from.name)}
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 13, fontWeight: 600 }}>{doc.from.name}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>Invoice</Text>
            <Text style={{ fontFamily: "DM Mono", color: GREY, marginTop: 4 }}>{doc.number}</Text>
          </View>
        </View>

        <View style={[s.row, { marginTop: 26, gap: 24 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Issued</Text>
            <Text>{day(doc.issueDate)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Due</Text>
            <Text>{day(doc.dueDate)}</Text>
          </View>
        </View>
        <View style={[s.row, { marginTop: 14, gap: 24 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>From</Text>
            <PartyBlock party={doc.from} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Bill to</Text>
            {doc.to ? <PartyBlock party={doc.to} /> : null}
          </View>
        </View>

        <View style={{ marginTop: 26 }}>
          <View
            style={[s.row, { borderBottomWidth: 0.75, borderBottomColor: RULE, paddingBottom: 5 }]}
          >
            <Text style={[s.th, { flex: 1 }]}>Item</Text>
            <Text style={[s.th, { width: 50, textAlign: "right" }]}>Qty</Text>
            <Text style={[s.th, { width: 80, textAlign: "right" }]}>Price</Text>
            <Text style={[s.th, { width: 90, textAlign: "right" }]}>Amount</Text>
          </View>
          {doc.lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: invoice lines are a fixed, ordered list.
            <View key={i} style={[s.row, s.td]} wrap={false}>
              <Text style={{ flex: 1, paddingRight: 8 }}>{line.description}</Text>
              <Text style={{ width: 50, textAlign: "right" }}>{line.quantity}</Text>
              <Text style={{ width: 80, textAlign: "right" }}>{usd(line.unitPrice)}</Text>
              <Text style={{ width: 90, textAlign: "right", fontWeight: 600 }}>
                {usd(line.amount)}
              </Text>
            </View>
          ))}
        </View>

        <View style={[s.between, { marginTop: 12, alignItems: "flex-end" }]} wrap={false}>
          <View>{doc.status === "paid" ? <Stamp name={doc.from.name} /> : null}</View>
          <View style={{ width: 230, gap: 4 }}>
            <View style={s.between}>
              <Text style={{ color: GREY }}>Subtotal</Text>
              <Text>{usd(doc.subtotal)}</Text>
            </View>
            {BigInt(doc.discount) > 0n ? (
              <View style={s.between}>
                <Text style={{ color: GREY }}>{doc.discountLabel ?? "Discount"}</Text>
                <Text>−{usd(doc.discount)}</Text>
              </View>
            ) : null}
            {BigInt(doc.tax) > 0n ? (
              <View style={s.between}>
                <Text style={{ color: GREY }}>{doc.taxLabel ?? "Tax"}</Text>
                <Text>{usd(doc.tax)}</Text>
              </View>
            ) : null}
            <View
              style={[
                s.between,
                {
                  borderTopWidth: 0.75,
                  borderTopColor: RULE,
                  paddingTop: 6,
                  marginTop: 2,
                  marginBottom: 4,
                  alignItems: "flex-end",
                },
              ]}
            >
              <Text style={{ fontWeight: 600 }}>Total</Text>
              <Text style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>
                {usd(doc.total)}
              </Text>
            </View>
            {doc.status === "open" && paid > 0n ? (
              <>
                <View style={s.between}>
                  <Text style={{ color: GREY }}>Paid</Text>
                  <Text>−{usd(doc.paidTotal)}</Text>
                </View>
                <View style={s.between}>
                  <Text style={{ fontWeight: 600 }}>Left to pay</Text>
                  <Text style={{ fontWeight: 600 }}>{usd(doc.remaining)}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {doc.notes ? (
          <View style={{ marginTop: 20, backgroundColor: "#F5F5F5", padding: 12, borderRadius: 6 }}>
            <Text style={{ color: "#444" }}>{doc.notes}</Text>
          </View>
        ) : null}

        <View
          style={{
            position: "absolute",
            left: 44,
            right: 44,
            bottom: 36,
            borderTopWidth: 0.75,
            borderTopColor: RULE,
            borderTopStyle: "dashed",
            paddingTop: 10,
          }}
          fixed
        >
          {doc.status === "open" ? (
            <Text style={{ marginBottom: 4 }}>
              Pay online in dollars from any wallet:{" "}
              <Link src={doc.payUrl} style={{ color: SHU, textDecoration: "none" }}>
                {doc.payUrl}
              </Link>
            </Text>
          ) : null}
          <View style={s.between}>
            <Text style={{ color: GREY, fontSize: 8.5 }}>
              USDC on NEAR{doc.sandbox ? " · Sandbox (testnet)" : ""} · {doc.payAddress}
            </Text>
            <Text style={{ color: GREY, fontSize: 8.5 }}>Made with Tegata</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

/** The invoice PDF as bytes, for a download or an email attachment. */
export function renderInvoicePdf(doc: InvoiceDocument): Promise<Buffer> {
  return renderToBuffer(<InvoicePdf doc={doc} />)
}
