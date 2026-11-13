// Every email Tegata sends, as data → content. Services queue an
// `EmailEvent` in the same transaction as the event it tells about; the worker composes it here and renders it with
// the one layout. The subject is the Activity row's words; the facts are the receipt page's rows.
import type { EmailContent, EmailRow } from "./layout.tsx"
import { coinFigure, FIAT_FLAG, fiatMoney, usdUnits } from "./money.ts"

/** USDC base units, as a string. */
type Units = string

/** USDC base units as "$1,250.00" (money.ts, the web app's formatter). */
export const usd = (units: Units) => usdUnits(units)

/** The round flag for a currency's row, when there is one. */
const flagOf = (fiat: string) => FIAT_FLAG[fiat.toUpperCase()]

export const longDay = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

const when = (iso: string, timezone: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })

const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-5)}`
const shortAddress = (a: string) => (a.length > 20 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a)

/** The marks the emails carry (public/email/marks); anything else falls back to NEAR Intents. */
const EMAIL_MARKS = new Set([
  "arb",
  "base",
  "bnb",
  "btc",
  "circle",
  "eth",
  "gnosis",
  "intents",
  "near",
  "pol",
  "sol",
  "tron",
  "usdc",
  "usdt",
])
const markOr = (id: string) => (EMAIL_MARKS.has(id) ? id : "intents")

/**
 * The mark for a "Paid with" row: the seal for a Tegata balance, NEAR for a NEAR wallet, the coin actually
 * sent for a payment from another chain ("USDT on Tron → USDC on NEAR"), NEAR Intents when the coin isn't known.
 */
function paidWithMark(paidWith: string): string | undefined {
  if (paidWith === "Tegata balance") return "tegata"
  if (paidWith === "NEAR wallet") return "near"
  if (!paidWith.includes("→")) return undefined
  return markOr(paidWith.split(" ")[0]?.toLowerCase() ?? "")
}

/** A NEAR account is shown in mono with the NEAR mark; a description ("a Tegata account") in words with the seal. */
const destinationRow = (label: string, destination: string): EmailRow =>
  /\s/.test(destination)
    ? { label, value: destination, mark: "tegata" }
    : { label, value: shortAddress(destination), mono: true, mark: "near" }

/** What every money email knows about where it settled. */
interface Settled {
  business: string
  logo: string | null
  sandbox: boolean
  timezone: string
  at: string
  txHash: string | null
  explorerUrl: string | null
}

export interface PaymentData extends Settled {
  amount: Units
  title: string
  /** The payer's account or address, when known. */
  from: string | null
  /** "Tegata balance", "NEAR wallet", "USDT on Tron → USDC on NEAR"… */
  paidWith: string
  receiptUrl: string
  receiptNumber: number | null
  /** An invoice paid in part: what's left. */
  remaining: Units | null
  invoiceNumber: string | null
  /** The owner's page for it (the invoice or the link). */
  ownerUrl: string | null
}

export interface InvoiceData {
  business: string
  logo?: string | null
  customer: string
  number: string
  total: Units
  remaining: Units
  dueDate: string
  url: string
  notes: string | null
  sandbox: boolean
  /** Reminders: days from the due date (−3, 0, 3, 7). */
  offset?: number
  /** The invoice, so the worker can attach its PDF and log the email on its timeline. */
  invoiceId?: string
}

export interface PayslipData extends Settled {
  person: string
  amount: Units
  period: string
  account: string
  url: string
  autopilot: boolean
}

export interface MoveData extends Settled {
  amount: Units
  /** The other side: an account or an address. */
  counterparty: string
  /** Why it moved, e.g. "Refund of Invoice INV-0004". */
  title: string
  receiptUrl: string | null
  /** To another chain through NEAR Intents. */
  delivered?: {
    route: string
    coin: string
    chainMark: string
    amountOut: string | null
    txUrl: string | null
  } | null
}

export type EmailEvent =
  | { kind: "payment.received"; data: PaymentData }
  | { kind: "payment.receipt"; data: PaymentData }
  | { kind: "invoice.sent"; data: InvoiceData }
  | { kind: "invoice.reminder"; data: InvoiceData }
  | { kind: "invoice.void"; data: InvoiceData }
  | { kind: "invoice.overdue"; data: InvoiceData & { ownerUrl: string; daysLate: number } }
  | {
      kind: "invoice.paid_by_hand"
      data: InvoiceData & { amount: Units; note: string | null; receiptUrl: string | null }
    }
  | {
      kind: "payroll.invite"
      data: {
        business: string
        logo: string | null
        person: string
        role: string | null
        amount: Units
        cadence: string
        url: string
        sandbox: boolean
        reminder?: boolean
      }
    }
  | { kind: "payroll.paid"; data: PayslipData }
  | {
      kind: "payroll.run"
      data: {
        business: string
        sandbox: boolean
        status: "paid" | "failed"
        paid: number
        failed: number
        total: Units
        payday: string
        url: string
        autopilot: boolean
      }
    }
  | {
      kind: "payroll.due"
      data: {
        business: string
        sandbox: boolean
        people: number
        total: Units
        payday: string
        url: string
      }
    }
  | {
      kind: "destination.pending"
      data: {
        business: string
        sandbox: boolean
        person: string
        destination: string
        activatesAt: string
        timezone: string
        url: string
        to: "person" | "owner"
      }
    }
  | {
      kind: "destination.set"
      data: { business: string; sandbox: boolean; person: string; destination: string; url: string }
    }
  | {
      kind: "autopilot.underfunded"
      data: {
        business: string
        sandbox: boolean
        needed: Units
        available: Units
        payday: string
        url: string
      }
    }
  | {
      kind: "autopilot.on"
      data: {
        business: string
        sandbox: boolean
        people: number
        setAside: Units
        paydays: string[]
        url: string
      }
    }
  | { kind: "payout.delivered"; data: MoveData }
  | { kind: "payout.returned"; data: MoveData & { reason: string } }
  | { kind: "refund.sent"; data: MoveData }
  | { kind: "refund.received"; data: MoveData }
  | { kind: "send.sent"; data: MoveData }
  | { kind: "send.received"; data: MoveData }
  | { kind: "referral.paid"; data: MoveData & { other: string } }
  | {
      kind: "bank.paid" | "bank.failed"
      data: Settled & {
        amount: Units
        account: string
        fiat: string
        fiatAmount: string
        rate: string
        reason?: string | null
        url: string
      }
    }
  | {
      kind: "bank.received"
      data: Settled & { amount: Units; fiat: string; fiatAmount: string; url: string }
    }
  | {
      kind: "referral.joined"
      data: {
        business: string
        joined: string
        sandbox: boolean
        threshold: Units
        reward: Units
        url: string
      }
    }
  | {
      kind: "referral.qualified"
      data: {
        business: string
        other: string
        sandbox: boolean
        reward: Units
        payAt: string
        url: string
      }
    }
  | {
      kind: "account.welcome" | "account.live"
      data: { business: string; accountId: string; sandbox: boolean; url: string }
    }
  | {
      kind: "payin.refunded"
      data: {
        business: string
        sandbox: boolean
        amount: Units
        route: string
        title: string
        url: string
      }
    }
  | {
      kind: "apikey.created"
      data: { business: string; sandbox: boolean; name: string; prefix: string; url: string }
    }
  | {
      kind: "webhook.failing"
      data: {
        business: string
        sandbox: boolean
        endpoint: string
        event: string
        tries: number
        url: string
      }
    }
  | {
      kind: "statement.monthly"
      data: {
        business: string
        sandbox: boolean
        month: string
        label: string
        moneyIn: Units
        moneyOut: Units
        net: Units
        count: number
        url: string
      }
    }

export type EmailKind = EmailEvent["kind"]

/** Emails an owner can switch off in Business → Emails. Security and money-out notices always go. */
export const OPTIONAL_EMAILS: { kind: EmailKind; label: string }[] = [
  { kind: "payment.received", label: "You got paid" },
  { kind: "payroll.due", label: "Payroll is ready to approve" },
  { kind: "invoice.overdue", label: "An invoice is overdue" },
  { kind: "statement.monthly", label: "Monthly statement" },
]

const usdcRows = (d: Settled): EmailRow[] => [
  { label: "Settled", value: when(d.at, d.timezone) },
  { label: "Network fee", value: "Paid by Tegata" },
  ...(d.txHash && d.explorerUrl
    ? [
        {
          label: "Transaction",
          value: shortHash(d.txHash),
          href: d.explorerUrl,
          mono: true,
          mark: "near",
        },
      ]
    : []),
]

const sub = (sandbox: boolean) => `USDC on NEAR${sandbox ? " · Sandbox" : ""}`

/** The subject, the shape and everything on the page, for one event. */
export function compose(event: EmailEvent, assets: string): EmailContent {
  const base = { assets, links: [] as { label: string; href: string }[] }
  switch (event.kind) {
    case "payment.received": {
      const d = event.data
      const part = d.remaining && BigInt(d.remaining) > 0n
      return {
        ...base,
        shape: "slip",
        subject: part
          ? `You got paid ${usd(d.amount)} for ${d.invoiceNumber} (${usd(d.remaining ?? "0")} left)`
          : `You got paid ${usd(d.amount)}: ${d.title}`,
        preview: `${d.title} · ${d.paidWith}`,
        brand: { name: d.business, logo: d.logo },
        label: "You got paid",
        hero: usd(d.amount),
        tone: "in",
        sub: sub(d.sandbox),
        stamp: "Paid",
        rows: [
          { label: "For", value: d.title },
          ...(d.from ? [{ label: "From", value: shortAddress(d.from), mono: true }] : []),
          { label: "Paid with", value: d.paidWith, mark: paidWithMark(d.paidWith) },
          ...(part ? [{ label: "Left to pay", value: usd(d.remaining ?? "0") }] : []),
          ...usdcRows(d),
        ],
        button: { label: "Open the receipt", href: d.receiptUrl },
        links: d.ownerUrl
          ? [
              {
                label: d.invoiceNumber ? "Open the invoice" : "Open it in Tegata",
                href: d.ownerUrl,
              },
            ]
          : [],
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "payment.receipt": {
      const d = event.data
      const part = d.remaining && BigInt(d.remaining) > 0n
      return {
        ...base,
        shape: "slip",
        subject: d.invoiceNumber
          ? part
            ? `Thanks: ${usd(d.amount)} received for ${d.invoiceNumber}. ${usd(d.remaining ?? "0")} left`
            : `${d.invoiceNumber} is paid. Your receipt from ${d.business}`
          : `Your receipt from ${d.business}: ${usd(d.amount)}`,
        preview: `${usd(d.amount)} to ${d.business} for ${d.title}`,
        brand: { name: d.business, logo: d.logo },
        label: d.receiptNumber ? `Receipt · No. ${d.receiptNumber}` : "Receipt",
        hero: usd(d.amount),
        tone: "plain",
        sub: sub(d.sandbox),
        stamp: "Paid",
        rows: [
          { label: "Paid to", value: d.business },
          { label: "For", value: d.title },
          { label: "Paid with", value: d.paidWith, mark: paidWithMark(d.paidWith) },
          ...(part ? [{ label: "Left to pay", value: usd(d.remaining ?? "0") }] : []),
          ...usdcRows(d),
        ],
        button: { label: "View your receipt", href: d.receiptUrl },
        audience: "customer",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "invoice.sent":
    case "invoice.reminder": {
      const d = event.data
      const reminder = event.kind === "invoice.reminder"
      const offset = d.offset ?? 0
      // The last step (+7 days) is the final reminder; nothing is sent after it.
      const final = reminder && offset >= 7
      const late = reminder && offset > 0
      const lead = !reminder
        ? `Here is invoice ${d.number} from ${d.business}.`
        : offset < 0
          ? `A reminder: ${d.number} is due on ${longDay(d.dueDate)}.`
          : offset === 0
            ? `${d.number} is due today.`
            : final
              ? `${d.number} was due on ${longDay(d.dueDate)}. This is the last reminder.`
              : `${d.number} was due on ${longDay(d.dueDate)}.`
      const subject = !reminder
        ? `${d.number} from ${d.business}: ${usd(d.remaining)} due ${longDay(d.dueDate)}`
        : offset < 0
          ? `Reminder: ${d.number} from ${d.business}, ${usd(d.remaining)} due ${longDay(d.dueDate)}`
          : offset === 0
            ? `${d.number} from ${d.business} is due today: ${usd(d.remaining)}`
            : final
              ? `Final reminder: ${d.number} from ${d.business}, ${usd(d.remaining)}`
              : `${d.number} from ${d.business} is ${offset} days overdue: ${usd(d.remaining)}`
      return {
        ...base,
        shape: "card",
        subject,
        preview: `${d.number} for ${usd(d.total)}, due ${longDay(d.dueDate)}`,
        brand: { name: d.business, logo: d.logo },
        label: `Invoice ${d.number}`,
        hero:
          !reminder || offset < 0
            ? `${usd(d.remaining)} due ${longDay(d.dueDate)}`
            : offset === 0
              ? `${usd(d.remaining)} due today`
              : `${usd(d.remaining)} overdue`,
        body: [
          `Hi ${d.customer},`,
          lead,
          ...(d.notes && !reminder ? [d.notes] : []),
          ...(late
            ? ["Already paid? Ignore this. Reminders stop once the payment shows on NEAR."]
            : []),
        ],
        rows: [
          { label: "Total", value: usd(d.total) },
          ...(d.remaining !== d.total ? [{ label: "Left to pay", value: usd(d.remaining) }] : []),
          { label: "Pay with", value: "Any coin, any chain, or a NEAR wallet" },
        ],
        button: { label: "View and pay", href: d.url },
        links: reminder ? [] : [{ label: "The PDF is attached", href: d.url }],
        audience: "customer",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "invoice.void": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `${d.number} from ${d.business} was cancelled`,
        preview: `You don't need to pay ${d.number}.`,
        brand: { name: d.business, logo: d.logo },
        label: `Invoice ${d.number}`,
        hero: "This invoice was cancelled",
        body: [
          `Hi ${d.customer},`,
          `${d.business} cancelled ${d.number} (${usd(d.total)}). There's nothing to pay.`,
        ],
        button: { label: "View the invoice", href: d.url },
        audience: "customer",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "invoice.overdue": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `${d.number} from ${d.customer} is ${d.daysLate} days overdue: ${usd(d.remaining)}`,
        preview: `Due ${longDay(d.dueDate)}. ${d.customer} got a reminder too.`,
        brand: { name: d.business, logo: d.logo },
        label: `Invoice ${d.number} · ${d.customer}`,
        hero: `${usd(d.remaining)} is ${d.daysLate} days overdue`,
        body: [`It was due on ${longDay(d.dueDate)}. Tegata has sent ${d.customer} a reminder.`],
        button: { label: "Open the invoice", href: d.ownerUrl },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "invoice.paid_by_hand": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `${d.business} marked ${d.number} paid`,
        preview: `${usd(d.amount)} recorded as paid outside Tegata.`,
        brand: { name: d.business, logo: d.logo },
        label: `Invoice ${d.number}`,
        hero: `${usd(d.amount)} marked paid`,
        body: [
          `Hi ${d.customer},`,
          `${d.business} recorded ${usd(d.amount)} on ${d.number} as paid outside Tegata.`,
          ...(d.note ? [d.note] : []),
        ],
        button: d.receiptUrl
          ? { label: "View your receipt", href: d.receiptUrl }
          : { label: "View the invoice", href: d.url },
        audience: "customer",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "payroll.invite": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: d.reminder
          ? `Reminder: choose where your pay from ${d.business} lands`
          : `${d.business} added you to payroll`,
        preview: `${usd(d.amount)} ${d.cadence}. Choose where it lands.`,
        brand: { name: d.business, logo: d.logo },
        label: `${d.business} added you to payroll`,
        hero: "Choose where your pay lands",
        body: [
          `Hi ${d.person},`,
          "Pick a Tegata account (sign in with this email) or a NEAR account you already have.",
        ],
        rows: [
          ...(d.role ? [{ label: "Role", value: d.role }] : []),
          { label: "Pay", value: `${usd(d.amount)} ${d.cadence}` },
          { label: "Paid in", value: "USDC on NEAR", mark: "usdc" },
        ],
        button: { label: "Choose where pay lands", href: d.url },
        audience: "person",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "payroll.paid": {
      const d = event.data
      return {
        ...base,
        shape: "slip",
        subject: `You've been paid ${usd(d.amount)} by ${d.business}`,
        preview: `${d.period}${d.autopilot ? " · paid by autopilot" : ""}`,
        brand: { name: d.business, logo: d.logo },
        label: "Payslip",
        hero: usd(d.amount),
        tone: "in",
        sub: sub(d.sandbox),
        stamp: "Payslip",
        rows: [
          { label: "For", value: d.period },
          { label: "From", value: d.business },
          { label: "Paid to", value: d.account, mono: true },
          {
            label: "Paid with",
            value: d.autopilot ? "Payroll, by autopilot on NEAR" : "Payroll",
            mark: d.autopilot ? "near" : "tegata",
          },
          ...usdcRows(d),
        ],
        button: { label: "Open your payslip", href: d.url },
        audience: "person",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "payroll.run": {
      const d = event.data
      const paid = d.status === "paid"
      return {
        ...base,
        shape: "card",
        subject: paid
          ? `Payroll paid: ${d.paid} ${d.paid === 1 ? "person" : "people"}, ${usd(d.total)}`
          : "Payroll: a batch didn't go through. Nothing in it moved",
        preview: `Payday ${longDay(d.payday)}${d.autopilot ? " · by autopilot" : ""}`,
        brand: { name: d.business },
        label: `Payroll · ${longDay(d.payday)}${d.autopilot ? " · by autopilot" : ""}`,
        hero: paid
          ? `${usd(d.total)} paid to ${d.paid} ${d.paid === 1 ? "person" : "people"}`
          : `${d.failed} not paid`,
        body: paid
          ? ["Everyone in this run got their payslip."]
          : [
              `${d.paid} paid, ${d.failed} not. The rows that failed moved nothing; retry them from the run.`,
            ],
        button: { label: "Open the run", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "payroll.due": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `Payroll for ${longDay(d.payday)} is ready: ${d.people} ${d.people === 1 ? "person" : "people"}, ${usd(d.total)}`,
        preview: "Review it and approve with one hold.",
        brand: { name: d.business },
        label: `Payday · ${longDay(d.payday)}`,
        hero: `${usd(d.total)} to ${d.people} ${d.people === 1 ? "person" : "people"}`,
        body: ["One approval pays everyone at once. Tegata pays the network fee."],
        button: { label: "Review and approve", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "destination.pending": {
      const d = event.data
      const person = d.to === "person"
      const where = person ? d.destination.replace(/^their /, "your ") : d.destination
      return {
        ...base,
        shape: "card",
        subject: person
          ? `Your pay will go to ${where} from ${when(d.activatesAt, d.timezone)}`
          : `${d.person} changed where their pay lands`,
        preview: person
          ? `Not you? Tell ${d.business} before then.`
          : `It takes effect ${when(d.activatesAt, d.timezone)}.`,
        brand: { name: d.business },
        label: "Where pay lands",
        hero: person ? "Your pay is moving" : `${d.person} changed where pay lands`,
        rows: [
          destinationRow("To", where),
          { label: "Takes effect", value: when(d.activatesAt, d.timezone) },
        ],
        body: person
          ? [`Not you? Tell ${d.business} before then.`]
          : ["Until then, payroll pays the old destination."],
        button: { label: person ? "See where your pay lands" : "Review the change", href: d.url },
        audience: person ? "person" : "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "destination.set": {
      const d = event.data
      const where = d.destination.replace(/^their /, "your ")
      return {
        ...base,
        shape: "card",
        subject: `${d.business} set your pay to land in ${where}`,
        preview: "You can change it on your page.",
        brand: { name: d.business },
        label: "Where pay lands",
        hero: "Your pay destination is set",
        rows: [destinationRow("To", where)],
        body: ["You can choose somewhere else on your page."],
        button: { label: "See where your pay lands", href: d.url },
        audience: "person",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "autopilot.underfunded": {
      const d = event.data
      const short = BigInt(d.needed) - BigInt(d.available)
      return {
        ...base,
        shape: "card",
        subject: `Autopilot couldn't pay ${longDay(d.payday)}'s payroll: ${usd(short.toString())} short`,
        preview: `It needs ${usd(d.needed)}; ${usd(d.available)} is set aside.`,
        brand: { name: d.business },
        label: "Autopilot",
        hero: `${usd(short.toString())} short`,
        body: [
          `${longDay(d.payday)}'s payroll needs ${usd(d.needed)} and ${usd(d.available)} is set aside. Nothing was paid. Add money and it runs on its own.`,
        ],
        button: { label: "Add money to autopilot", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "autopilot.on": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `Autopilot is on: pays ${d.people} ${d.people === 1 ? "person" : "people"}, ${usd(d.setAside)} set aside`,
        preview: d.paydays[0] ? `First payday ${longDay(d.paydays[0])}` : "It runs on its own.",
        brand: { name: d.business },
        label: "Autopilot",
        hero: `${usd(d.setAside)} set aside`,
        body: [
          "Tegata's contract on NEAR pays your team each payday, with everyone offline, and confirms every row.",
          ...(d.paydays.length ? [`Paydays: ${d.paydays.map(longDay).join(", ")}.`] : []),
        ],
        button: { label: "Open payroll", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "payout.delivered":
    case "refund.sent":
    case "refund.received":
    case "send.sent":
    case "send.received":
    case "referral.paid": {
      const d = event.data
      const incoming =
        event.kind === "refund.received" ||
        event.kind === "send.received" ||
        event.kind === "referral.paid"
      const word =
        event.kind === "payout.delivered"
          ? "Delivered"
          : event.kind.startsWith("refund")
            ? "Refunded"
            : event.kind === "referral.paid"
              ? "Paid"
              : "Sent"
      const delivered = d.delivered
      const deliveredAs = delivered
        ? `${delivered.amountOut ? `${coinFigure(delivered.amountOut, delivered.coin)} ` : ""}${delivered.route}`
        : ""
      const subject =
        event.kind === "payout.delivered"
          ? `Delivered: ${usd(d.amount)} → ${deliveredAs}`.trim()
          : event.kind === "refund.sent"
            ? `Refund sent: ${usd(d.amount)} to ${shortAddress(d.counterparty)}`
            : event.kind === "refund.received"
              ? `${d.business} refunded you ${usd(d.amount)}`
              : event.kind === "send.sent"
                ? `Sent ${usd(d.amount)} to ${shortAddress(d.counterparty)}`
                : event.kind === "send.received"
                  ? `${d.business} sent you ${usd(d.amount)}`
                  : `You earned ${usd(d.amount)}: ${(event.data as { other: string }).other}`
      return {
        ...base,
        shape: "slip",
        subject,
        preview: d.title,
        brand: {
          name: event.kind === "referral.paid" ? "Tegata" : d.business,
          logo: event.kind === "referral.paid" ? null : d.logo,
        },
        label: incoming
          ? event.kind === "referral.paid"
            ? "Referral reward"
            : "You received"
          : "You sent",
        hero: usd(d.amount),
        tone: incoming ? "in" : "out",
        sub: sub(d.sandbox),
        stamp: word,
        rows: [
          { label: "For", value: d.title },
          {
            label: incoming ? "From" : "To",
            value: incoming ? d.business : shortAddress(d.counterparty),
            mono: !incoming,
          },
          ...(delivered
            ? [
                {
                  label: "Delivered as",
                  value: deliveredAs,
                  mark: markOr(delivered.coin),
                },
                { label: "Converted by", value: "NEAR Intents", mark: "intents" },
              ]
            : []),
          ...usdcRows(d),
          ...(delivered?.txUrl
            ? [{ label: "Delivery", value: "On the other chain", href: delivered.txUrl }]
            : []),
        ],
        button: d.receiptUrl ? { label: "Open the receipt", href: d.receiptUrl } : null,
        audience: incoming
          ? event.kind === "send.received" || event.kind === "refund.received"
            ? "customer"
            : "owner"
          : "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "payout.returned": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `Your ${usd(d.amount)} to ${d.delivered?.route ?? "another chain"} didn't arrive. It's back in your balance`,
        preview: d.reason,
        brand: { name: d.business },
        label: "Payment to another chain",
        hero: `${usd(d.amount)} came back`,
        body: [
          `${d.reason} The ${usd(d.amount)} is back in your balance on NEAR; nothing reached ${shortAddress(d.counterparty)}.`,
        ],
        button: d.receiptUrl ? { label: "See what happened", href: d.receiptUrl } : null,
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "bank.paid": {
      const d = event.data
      return {
        ...base,
        shape: "slip",
        subject: `Paid to ${d.account}: ${fiatMoney(d.fiat, d.fiatAmount)}`,
        preview: `${usd(d.amount)} from your balance, paid by Noah`,
        brand: { name: d.business, logo: d.logo },
        label: "Withdrawn to a bank",
        hero: usd(d.amount),
        tone: "out",
        sub: sub(d.sandbox),
        stamp: "Paid",
        rows: [
          { label: "To", value: d.account },
          {
            label: "They received",
            value: fiatMoney(d.fiat, d.fiatAmount),
            flag: flagOf(d.fiat),
          },
          { label: "Rate", value: `${fiatMoney(d.fiat, d.rate)} per dollar` },
          { label: "Paid out by", value: "Noah, a licensed partner" },
          ...usdcRows(d),
        ],
        button: { label: "Open Bank", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "bank.failed": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `Your withdrawal to ${d.account} didn't go through. The ${usd(d.amount)} is back`,
        preview: d.reason ?? "Noah couldn't pay the bank account.",
        brand: { name: d.business },
        label: "Withdraw to a bank",
        hero: `${usd(d.amount)} came back`,
        body: [
          `${d.reason ?? "Noah couldn't pay the bank account."} The dollars are back in your balance on NEAR.`,
        ],
        button: { label: "Open Bank", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "bank.received": {
      const d = event.data
      return {
        ...base,
        shape: "slip",
        subject: `${fiatMoney(d.fiat, d.fiatAmount)} arrived by bank transfer: ${usd(d.amount)} in your balance`,
        preview: "Converted to USDC on NEAR.",
        brand: { name: d.business, logo: d.logo },
        label: "Received by bank transfer",
        hero: usd(d.amount),
        tone: "in",
        sub: sub(d.sandbox),
        stamp: "Paid",
        rows: [
          {
            label: "Bank transfer",
            value: fiatMoney(d.fiat, d.fiatAmount),
            flag: flagOf(d.fiat),
          },
          { label: "Converted by", value: "Noah, to USDC" },
          ...usdcRows(d),
        ],
        button: { label: "Open Bank", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "referral.joined": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `${d.joined} joined Tegata with your link`,
        preview: `When they receive ${usd(d.threshold)} from customers, you both get ${usd(d.reward)}.`,
        brand: { name: "Tegata" },
        label: "Refer",
        hero: `${d.joined} joined with your link`,
        body: [
          `When ${d.joined} receives ${usd(d.threshold)} from their own customers, you each get ${usd(d.reward)} in USDC on NEAR.`,
        ],
        button: { label: "Open Refer", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "referral.qualified": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `${d.other} qualified: ${usd(d.reward)} each, paid ${longDay(d.payAt)}`,
        preview: "The reward is paid after a short hold.",
        brand: { name: "Tegata" },
        label: "Refer",
        hero: `${usd(d.reward)} is on its way`,
        body: [
          `Your referral with ${d.other} qualified. Tegata pays you each ${usd(d.reward)} in USDC on NEAR after the hold, on ${longDay(d.payAt)}.`,
        ],
        button: { label: "Open Refer", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "account.welcome":
    case "account.live": {
      const d = event.data
      const live = event.kind === "account.live"
      return {
        ...base,
        shape: "card",
        subject: live
          ? `Live is on: ${d.business} can take real dollars`
          : `${d.business} is open on Tegata`,
        preview: live
          ? "Real USDC on NEAR. Tegata pays every network fee."
          : "Send an invoice or a pay link and get paid from any chain.",
        brand: { name: d.business },
        label: live ? "Live" : "Welcome to Tegata",
        hero: live ? "Live is on" : "Your account is open",
        rows: [{ label: "Pay address", value: d.accountId, mono: true, mark: "near" }],
        body: live
          ? ["Real dollars from any chain. Tegata pays every network fee."]
          : ["Send an invoice or a pay link and get paid in dollars from any chain."],
        button: {
          label: live ? "Make your first pay link" : "Send your first invoice",
          href: d.url,
        },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "payin.refunded": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `A ${usd(d.amount)} payment from ${d.route} didn't complete. The payer was refunded`,
        preview: d.title,
        brand: { name: d.business },
        label: d.title,
        hero: "Payment refunded to the payer",
        body: [
          `NEAR Intents returned the payer's coins. Nothing reached your balance; the link is still open.`,
        ],
        button: { label: "Open it in Tegata", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "apikey.created": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `A new ${d.sandbox ? "Sandbox" : "Live"} API key was created: ${d.prefix}…`,
        preview: `"${d.name}". If this wasn't you, revoke it.`,
        brand: { name: d.business },
        label: "Developers",
        hero: `${d.prefix}…`,
        body: [
          `An API key named "${d.name}" was created for ${d.business}. If this wasn't you, revoke it now.`,
        ],
        button: { label: "Review your keys", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "webhook.failing": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `Your webhook to ${d.endpoint} is failing (${d.tries} tries)`,
        preview: `${d.event} couldn't be delivered.`,
        brand: { name: d.business },
        label: "Developers",
        hero: `${d.event} wasn't delivered`,
        body: [
          `No 2xx answer after ${d.tries} tries. Resend it from the delivery log once the endpoint is back.`,
        ],
        button: { label: "Open Developers", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
    case "statement.monthly": {
      const d = event.data
      return {
        ...base,
        shape: "card",
        subject: `${d.business}, ${d.label}: in ${usd(d.moneyIn)}, out ${usd(d.moneyOut)}`,
        preview: `${d.count} movements. The statement PDF is attached.`,
        brand: { name: d.business },
        label: `Statement · ${d.label}`,
        hero: `${BigInt(d.net) < 0n ? "−" : "+"}${usd((BigInt(d.net) < 0n ? -BigInt(d.net) : BigInt(d.net)).toString())} net`,
        rows: [
          { label: "Money in", value: usd(d.moneyIn) },
          { label: "Money out", value: usd(d.moneyOut) },
          { label: "Movements", value: String(d.count) },
        ],
        body: [
          "The statement PDF is attached. Every line links to its NEAR transaction in Activity.",
        ],
        button: { label: "Open the books", href: d.url },
        audience: "owner",
        business: d.business,
        sandbox: d.sandbox,
      }
    }
  }
}
