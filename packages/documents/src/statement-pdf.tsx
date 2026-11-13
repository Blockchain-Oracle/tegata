/** @jsxRuntime automatic */
/** @jsxImportSource react */
// The monthly statement: the business header and seal, the month, money in, money out and net, every
// movement in order, and the balance on NEAR when it was made. Drawn with @react-pdf/renderer on the server, in the
// invoice's own fonts (registered in invoice-pdf.tsx).
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer"

import "./invoice-pdf.tsx"

const SHU = "#FF4F00"
const INK = "#16130F"
const GREY = "#5B544A"
const RULE = "#E9E3D6"
const UP = "#2F7A00"
const UNITS_PER_DOLLAR = 1e6

export interface StatementLine {
  /** "12 Nov 2026, 14:05" in the business's time zone. */
  when: string
  title: string
  counterparty: string
  /** USDC base units; positive in, negative out. */
  amount: string
  status: string
  /** Shown, not totalled (an autopilot payroll paid from money already set aside). */
  counted: boolean
  tx: string | null
}

export interface StatementDocument {
  business: string
  address: string | null
  taxId: string | null
  logo: string | null
  /** "November 2026". */
  month: string
  timezone: string
  accountId: string
  usdc: string
  network: "mainnet" | "testnet"
  moneyIn: string
  moneyOut: string
  net: string
  /** The on-chain balance when the statement was made, and when. */
  balance: string
  madeAt: string
  lines: StatementLine[]
}

/** "Proof Books Studio" → "PS": first and last word, like the app's seal. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const pair =
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`
      : (words[0]?.slice(0, 2) ?? "")
  return pair.toUpperCase()
}

const usd = (units: string) =>
  (Number(BigInt(units)) / UNITS_PER_DOLLAR).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })

const s = StyleSheet.create({
  page: { fontFamily: "Archivo", fontSize: 9.5, color: INK, padding: 44, lineHeight: 1.4 },
  between: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 8.5, fontWeight: 600, color: GREY, marginBottom: 3 },
  th: { fontSize: 8, fontWeight: 600, color: GREY },
  td: { paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: RULE },
})

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#F3EFE6", borderRadius: 10, padding: 12 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: 800, color: tone ?? INK }}>{value}</Text>
    </View>
  )
}

export function StatementPdf({ doc }: { doc: StatementDocument }) {
  return (
    <Document
      title={`${doc.business} statement, ${doc.month}`}
      author={doc.business}
      creator="Tegata"
    >
      <Page size="A4" style={s.page}>
        <View style={[s.between, { alignItems: "flex-start", marginBottom: 22 }]}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            {doc.logo ? (
              <Image src={doc.logo} style={{ width: 40, height: 40, borderRadius: 20 }} />
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 2.5,
                  borderColor: SHU,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: 800, color: SHU }}>
                  {initials(doc.business)}
                </Text>
              </View>
            )}
            <View>
              <Text style={{ fontSize: 13, fontWeight: 800 }}>{doc.business}</Text>
              {doc.address ? <Text style={{ color: "#3D3730" }}>{doc.address}</Text> : null}
              {doc.taxId ? <Text style={{ color: "#3D3730" }}>Tax ID {doc.taxId}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15, marginBottom: 2 }}>
              Statement
            </Text>
            <Text style={{ fontWeight: 600 }}>{doc.month}</Text>
            <Text style={{ color: GREY }}>Times in {doc.timezone}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
          <Figure label="Money in" value={usd(doc.moneyIn)} tone={UP} />
          <Figure label="Money out" value={usd(doc.moneyOut)} />
          <Figure label="Net" value={usd(doc.net)} />
          <Figure label={`Balance on NEAR, ${doc.madeAt}`} value={usd(doc.balance)} />
        </View>

        <View
          style={[s.between, { paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: INK }]}
        >
          <Text style={[s.th, { width: "20%" }]}>Date</Text>
          <Text style={[s.th, { width: "38%" }]}>What</Text>
          <Text style={[s.th, { width: "22%" }]}>With</Text>
          <Text style={[s.th, { width: "20%", textAlign: "right" }]}>Amount (USD)</Text>
        </View>
        {doc.lines.length === 0 ? (
          <Text style={{ paddingVertical: 14, color: GREY }}>Nothing moved this month.</Text>
        ) : (
          doc.lines.map((line) => {
            const units = BigInt(line.amount)
            return (
              <View
                key={`${line.when}:${line.title}:${line.amount}:${line.tx ?? ""}`}
                style={[s.between, s.td]}
                wrap={false}
              >
                <Text style={{ width: "20%", color: "#3D3730" }}>{line.when}</Text>
                <View style={{ width: "38%" }}>
                  <Text>{line.title}</Text>
                  {line.status !== "done" || !line.counted ? (
                    <Text style={{ fontSize: 7.5, color: GREY }}>
                      {line.status !== "done"
                        ? line.status
                        : "paid from autopilot money already set aside"}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={{ width: "22%", color: "#3D3730", fontFamily: "DM Mono", fontSize: 7.5 }}
                >
                  {line.counterparty}
                </Text>
                <Text
                  style={{
                    width: "20%",
                    textAlign: "right",
                    fontWeight: 600,
                    color: units > 0n ? UP : INK,
                  }}
                >
                  {units > 0n ? "+" : "−"}
                  {usd((units < 0n ? -units : units).toString())}
                </Text>
              </View>
            )
          })
        )}

        <View
          style={{ marginTop: 20, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: RULE }}
          fixed
        >
          <Text style={{ fontSize: 7.5, color: GREY }}>
            {doc.business} · {doc.accountId} · Dollars are USDC on NEAR
            {doc.network === "testnet" ? " testnet (Sandbox: test dollars, no real money)" : ""},
            contract {doc.usdc}. Each movement links to its transaction on NEAR in Tegata.
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export function renderStatementPdf(doc: StatementDocument): Promise<Buffer> {
  return renderToBuffer(<StatementPdf doc={doc} />)
}
