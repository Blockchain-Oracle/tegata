/** @jsxRuntime automatic */
/** @jsxImportSource react */
// The payslip as an A4 PDF: one person's pay from one run, in the invoice's and the statement's style. Who paid whom,
// for which period, gross to net with year to date, deductions said honestly (Tegata withholds nothing), how the
// money moved (USDC on NEAR, or what NEAR Intents delivered on another chain) and the NEAR transaction, stamped PAID.
// Fonts are registered in invoice-pdf.tsx.
import {
  Document,
  Image,
  Link,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import "./invoice-pdf.tsx"

const SHU = "#FF4F00"
const INK = "#16130F"
const GREY = "#5B544A"
const SOFT = "#3D3730"
const RULE = "#E9E3D6"
const TILE = "#F3EFE6"
const UNITS_PER_DOLLAR = 1e6

export interface PayslipDocument {
  /** "payslip", or "receipt" for a contractor (a payment receipt, not a payslip). */
  kind: "payslip" | "receipt"
  /** "PS-1A2B3C4D". */
  reference: string
  business: {
    name: string
    address: string | null
    taxId: string | null
    email: string | null
    /** A PNG or JPEG data URL, or null (a monogram seal stands in). */
    logo: string | null
    accountId: string
  }
  person: {
    name: string
    role: string | null
    /** "P-9F3A21". */
    reference: string
    /** Masked: "m•••@studio.example". */
    email: string | null
  }
  /** "Pay · 1–30 Nov 2026". */
  periodLabel: string
  periodFrom: string
  periodTo: string
  /** The run's payday, ISO date. */
  payDate: string
  /** "13 Nov 2026, 17:40" in the business's time zone. */
  paidAt: string
  timezone: string
  /** "Monthly", "Fortnightly", "Weekly", or null. */
  frequency: string | null
  /** USDC base units. */
  gross: string
  net: string
  /** This person's paid pay from this business in the same calendar year, this one included. */
  yearToDate: string
  year: number
  how: {
    /** "USDC on NEAR (Circle)", "USDT on Tron, converted by NEAR Intents". */
    paidIn: string
    /** The account or address it landed in. */
    to: string
    /** "Tegata account", "NEAR account", "Address on Tron". */
    toKind: string
    /** What arrived on the other chain, e.g. "2,399.81 USDT". */
    delivered: string | null
    deliveryTx: string | null
    deliveryTxUrl: string | null
    nearTx: string | null
    nearTxUrl: string | null
    /** "tegata:payroll:<row id>". */
    memo: string
    autopilot: boolean
  }
  /** Public page to check it against. */
  checkUrl: string
  sandbox: boolean
  madeAt: string
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
    timeZone: "UTC",
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
  page: {
    fontFamily: "Archivo",
    fontSize: 9.5,
    color: INK,
    paddingTop: 40,
    paddingHorizontal: 44,
    // The footer sits in its own band at the foot, never over the last row.
    paddingBottom: 72,
    lineHeight: 1.35,
  },
  between: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 8.5, fontWeight: 600, color: GREY, marginBottom: 3 },
  th: { fontSize: 8, fontWeight: 600, color: GREY },
  td: { paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: RULE },
  mono: { fontFamily: "DM Mono", fontSize: 8 },
  section: { fontSize: 11, fontWeight: 800, marginBottom: 4 },
})

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: strong ? "#FFFFFF" : TILE,
        borderRadius: 10,
        padding: 12,
        borderWidth: strong ? 1.5 : 0,
        borderColor: SHU,
      }}
    >
      <Text style={s.label}>{label}</Text>
      <Text style={{ fontSize: strong ? 20 : 18, fontWeight: 800, color: strong ? SHU : INK }}>
        {value}
      </Text>
    </View>
  )
}

function Stamp({ name }: { name: string }) {
  return (
    <View
      style={{
        width: 84,
        height: 84,
        borderRadius: 42,
        borderWidth: 4,
        borderColor: SHU,
        alignItems: "center",
        justifyContent: "center",
        transform: "rotate(-8deg)",
      }}
    >
      <Text style={{ fontSize: 6.5, fontWeight: 800, color: SHU, letterSpacing: 1 }}>
        {name.toUpperCase().slice(0, 18)}
      </Text>
      <View
        style={{
          backgroundColor: SHU,
          paddingHorizontal: 9,
          paddingVertical: 3,
          marginVertical: 4,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF", letterSpacing: 1.5 }}>
          PAID
        </Text>
      </View>
      <Text style={{ fontSize: 6.5, fontWeight: 800, color: SHU, letterSpacing: 1 }}>TEGATA</Text>
    </View>
  )
}

/** A label over a value, for the dates strip and the parties. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={{ fontWeight: 600 }}>{children}</Text>
    </View>
  )
}

/** A row of "How it was paid": label on the left, value on the right. */
function HowRow({
  label,
  value,
  mono,
  href,
}: {
  label: string
  value: string
  mono?: boolean
  href?: string | null
}) {
  const text = <Text style={mono ? [s.mono, { color: INK }] : { fontWeight: 600 }}>{value}</Text>
  return (
    <View style={[s.between, s.td, { paddingVertical: 4 }]} wrap={false}>
      <Text style={{ width: "30%", color: GREY }}>{label}</Text>
      <View style={{ width: "70%", alignItems: "flex-end" }}>
        {href ? (
          <Link src={href} style={{ color: INK, textDecoration: "none" }}>
            {text}
          </Link>
        ) : (
          text
        )}
      </View>
    </View>
  )
}

export function PayslipPdf({ doc }: { doc: PayslipDocument }) {
  const title = doc.kind === "receipt" ? "Payment receipt" : "Payslip"
  return (
    <Document
      title={`${title} · ${doc.business.name} · ${doc.person.name} · ${doc.periodLabel}`}
      author={doc.business.name}
      creator="Tegata"
    >
      <Page size="A4" style={s.page}>
        {doc.sandbox ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: SHU,
              borderStyle: "dashed",
              borderRadius: 6,
              padding: 5,
              marginBottom: 14,
            }}
          >
            <Text style={{ color: SHU, fontWeight: 600, textAlign: "center", fontSize: 8.5 }}>
              Sandbox · test dollars on NEAR testnet, no real money
            </Text>
          </View>
        ) : null}

        <View style={[s.between, { alignItems: "flex-start", marginBottom: 16 }]}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", maxWidth: "60%" }}>
            {doc.business.logo ? (
              <Image src={doc.business.logo} style={{ width: 40, height: 40, borderRadius: 20 }} />
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
                  {monogram(doc.business.name)}
                </Text>
              </View>
            )}
            <View>
              <Text style={{ fontSize: 13, fontWeight: 800 }}>{doc.business.name}</Text>
              {doc.business.address ? (
                <Text style={{ color: SOFT }}>{doc.business.address}</Text>
              ) : null}
              {doc.business.taxId ? (
                <Text style={{ color: SOFT }}>Tax ID {doc.business.taxId}</Text>
              ) : null}
              {doc.business.email ? (
                <Text style={{ color: SOFT }}>{doc.business.email}</Text>
              ) : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15, marginBottom: 2 }}>
              {title}
            </Text>
            <Text style={{ fontWeight: 600 }}>{doc.periodLabel}</Text>
            <Text style={[s.mono, { color: GREY, marginTop: 2 }]}>{doc.reference}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 24, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Paid to</Text>
            <Text style={{ fontWeight: 800, fontSize: 11 }}>{doc.person.name}</Text>
            {doc.person.role ? <Text style={{ color: SOFT }}>{doc.person.role}</Text> : null}
            <Text style={{ color: SOFT }}>Reference {doc.person.reference}</Text>
            {doc.person.email ? <Text style={{ color: SOFT }}>{doc.person.email}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Paid by</Text>
            <Text style={{ fontWeight: 800, fontSize: 11 }}>{doc.business.name}</Text>
            <Text style={[s.mono, { color: SOFT }]}>{doc.business.accountId}</Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 12,
            backgroundColor: TILE,
            borderRadius: 10,
            padding: 10,
            marginBottom: 12,
          }}
        >
          <Fact label="Pay period">
            {day(doc.periodFrom)} – {day(doc.periodTo)}
          </Fact>
          <Fact label="Pay date">{day(doc.payDate)}</Fact>
          <Fact label="Paid at">{doc.paidAt}</Fact>
          <Fact label="Frequency">{doc.frequency ?? "One run"}</Fact>
        </View>

        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <Figure label="Gross pay" value={usd(doc.gross)} />
          <Figure label="Deductions" value={usd("0")} />
          <Figure label="Net pay" value={usd(doc.net)} strong />
          <View style={{ width: 92, alignItems: "center" }}>
            <Stamp name={doc.business.name} />
          </View>
        </View>

        <Text style={s.section}>Earnings</Text>
        <View
          style={[s.between, { paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: INK }]}
        >
          <Text style={[s.th, { width: "50%" }]}>Description</Text>
          <Text style={[s.th, { width: "25%", textAlign: "right" }]}>This period</Text>
          <Text style={[s.th, { width: "25%", textAlign: "right" }]}>Year to date {doc.year}</Text>
        </View>
        <View style={[s.between, s.td]}>
          <Text style={{ width: "50%" }}>Pay{doc.person.role ? ` · ${doc.person.role}` : ""}</Text>
          <Text style={{ width: "25%", textAlign: "right" }}>{usd(doc.gross)}</Text>
          <Text style={{ width: "25%", textAlign: "right", color: SOFT }}>
            {usd(doc.yearToDate)}
          </Text>
        </View>
        <View style={{ marginBottom: 12 }} />

        <Text style={s.section}>Deductions</Text>
        <View
          style={[s.between, { paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: INK }]}
        >
          <Text style={[s.th, { width: "50%" }]}>Line</Text>
          <Text style={[s.th, { width: "20%", textAlign: "right" }]}>Amount</Text>
          <Text style={[s.th, { width: "30%", textAlign: "right" }]}>Note</Text>
        </View>
        {[
          ["Income tax", "Not withheld"],
          ["Pension and social contributions", "Not withheld"],
          ["Tegata and network fees", "Paid by Tegata"],
        ].map(([line, note]) => (
          <View key={line} style={[s.between, s.td]}>
            <Text style={{ width: "50%" }}>{line}</Text>
            <Text style={{ width: "20%", textAlign: "right" }}>{usd("0")}</Text>
            <Text style={{ width: "30%", textAlign: "right", color: GREY }}>{note}</Text>
          </View>
        ))}
        <Text style={{ color: GREY, fontSize: 8.5, marginTop: 5, marginBottom: 12 }}>
          {doc.kind === "receipt"
            ? `${doc.business.name} paid this amount in full. You are paid as an independent contractor and handle your own taxes; Tegata doesn't calculate or withhold any.`
            : `${doc.business.name} paid this amount in full. Tegata doesn't calculate or withhold tax, pension or social contributions, and nothing was paid to a tax authority for you. Keep this payslip for your records, and ask ${doc.business.name} how your taxes are handled.`}
        </Text>

        <Text style={s.section}>How it was paid</Text>
        <View style={{ marginBottom: 6 }}>
          <HowRow label="Paid in" value={doc.how.paidIn} />
          <HowRow label={doc.how.toKind} value={doc.how.to} mono />
          {doc.how.delivered ? <HowRow label="Arrived" value={doc.how.delivered} /> : null}
          {doc.how.deliveryTx ? (
            <HowRow
              label="Delivery transaction"
              value={doc.how.deliveryTx}
              mono
              href={doc.how.deliveryTxUrl}
            />
          ) : null}
          {doc.how.nearTx ? (
            <HowRow label="NEAR transaction" value={doc.how.nearTx} mono href={doc.how.nearTxUrl} />
          ) : null}
          <HowRow label="Reference" value={doc.how.memo} mono />
        </View>
        <Text style={{ color: GREY, fontSize: 8.5 }}>
          {doc.how.autopilot
            ? "Paid by autopilot on NEAR, with nobody online."
            : "One approval paid the whole run, all or nothing."}
        </Text>

        <View
          style={{
            position: "absolute",
            left: 44,
            right: 44,
            bottom: 28,
            paddingTop: 8,
            borderTopWidth: 0.5,
            borderTopColor: RULE,
          }}
          fixed
        >
          <Text style={{ fontSize: 7.5, color: GREY }}>
            Check this {title.toLowerCase()} at{" "}
            <Link src={doc.checkUrl} style={{ color: GREY }}>
              {doc.checkUrl.replace(/^https?:\/\//, "")}
            </Link>{" "}
            · Settled on NEAR in USDC, issued by Circle · Issued with Tegata for {doc.business.name}{" "}
            · Made {doc.madeAt} ({doc.timezone})
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export function renderPayslipPdf(doc: PayslipDocument): Promise<Buffer> {
  return renderToBuffer(<PayslipPdf doc={doc} />)
}
