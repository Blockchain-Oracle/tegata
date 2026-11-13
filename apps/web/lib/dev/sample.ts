// Sample names and figures for /dev only (plan 6.9). Nothing outside app/dev imports this file.
import type {
  AutopilotPreview,
  AutopilotView,
  BooksMonth,
  Customer,
  DevelopersView,
  InvoiceDetail,
  InvoiceRow,
  LinkDetail,
  MovementView,
  PayLink,
  PayRun,
  PayRunRow,
  PayrollOverview,
  PaySlipRow,
  PersonPage,
  PublicRequest,
  ReceiptView,
  Reconciliation,
  TeamPerson,
} from "@/lib/client/types"

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const MIN = 60_000
const HOUR = 60 * MIN

export const SAMPLE_BUSINESS = "Studio Kaze"
export const SAMPLE_ACCOUNT = "studio-kaze.tegata.testnet"

export const SAMPLE_LINKS: PayLink[] = [
  {
    id: "7d1c2e4a-0000-4000-8000-000000000001",
    token: "h7Kq2mPx9cRt",
    title: "Logo design",
    note: "Final files are in the shared folder. Thank you!",
    amount: "1250000000",
    status: "open",
    network: "testnet",
    receiverId: SAMPLE_ACCOUNT,
    paidCount: 2,
    paidTotal: "2500000000",
    createdAt: ago(3 * 24 * HOUR),
  },
  {
    id: "7d1c2e4a-0000-4000-8000-000000000002",
    token: "Zp4wX8nQe2Ld",
    title: "Tip jar",
    note: null,
    amount: null,
    status: "open",
    network: "testnet",
    receiverId: SAMPLE_ACCOUNT,
    paidCount: 5,
    paidTotal: "86500000",
    createdAt: ago(9 * 24 * HOUR),
  },
  {
    id: "7d1c2e4a-0000-4000-8000-000000000003",
    token: "Rm3sV9kTb6Jw",
    title: "March retainer",
    note: null,
    amount: "3000000000",
    status: "closed",
    network: "testnet",
    receiverId: SAMPLE_ACCOUNT,
    paidCount: 0,
    paidTotal: "0",
    createdAt: ago(20 * 24 * HOUR),
  },
]

export const SAMPLE_DETAIL: LinkDetail = {
  request: SAMPLE_LINKS[0]!,
  payments: [
    {
      id: "p3",
      rail: "near_wallet",
      status: "detected",
      amount: "1250000000",
      payer: "mei.testnet",
      payerEmail: null,
      txHash: "9xQ2",
      error: null,
      settledAt: null,
      createdAt: ago(20_000),
      receiptToken: null,
    },
    {
      id: "p2",
      rail: "tegata",
      status: "succeeded",
      amount: "1250000000",
      payer: "northwind.tegata.testnet",
      payerEmail: null,
      txHash: "4a5U",
      error: null,
      settledAt: ago(2 * HOUR),
      createdAt: ago(2 * HOUR),
      receiptToken: "sampleReceipt01",
    },
    {
      id: "p1",
      rail: "near_wallet",
      status: "succeeded",
      amount: "1250000000",
      payer: "kofi.testnet",
      payerEmail: null,
      txHash: "8oDo",
      error: null,
      settledAt: ago(26 * HOUR),
      createdAt: ago(26 * HOUR),
      receiptToken: "sampleReceipt02",
    },
  ],
}

export const SAMPLE_REQUEST: PublicRequest = {
  token: "h7Kq2mPx9cRt",
  business: SAMPLE_BUSINESS,
  logo: null,
  title: "Logo design",
  note: "Final files are in the shared folder. Thank you!",
  amount: "1250000000",
  status: "open",
  network: "testnet",
  receiverId: SAMPLE_ACCOUNT,
  usdc: "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af",
  successUrl: null,
  receiptToken: null,
  invoice: null,
}

export const SAMPLE_RECEIPT: ReceiptView = {
  kind: "payment",
  number: 7,
  business: SAMPLE_BUSINESS,
  logo: null,
  title: "Logo design",
  amount: "1250000000",
  method: "tegata",
  payer: "northwind.tegata.testnet",
  payerName: null,
  receiverName: SAMPLE_BUSINESS,
  receiverId: SAMPLE_ACCOUNT,
  network: "testnet",
  settledAt: ago(2 * HOUR),
  feeBy: "tegata",
  txHash: "4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX",
  explorerUrl: "https://testnet.nearblocks.io/txns/4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX",
}

/** A send's receipt: stamped SENT with the business seal, the fee paid by Tegata. */
export const SAMPLE_SEND_RECEIPT: ReceiptView = {
  ...SAMPLE_RECEIPT,
  kind: "send",
  number: null,
  title: "One-off payment",
  amount: "240000000",
  payer: SAMPLE_ACCOUNT,
  payerName: SAMPLE_BUSINESS,
  receiverName: "kofi.tegata.testnet",
  receiverId: "kofi.tegata.testnet",
}

/** A referral reward's receipt: from Tegata, under Tegata's own seal. */
export const SAMPLE_REWARD_RECEIPT: ReceiptView = {
  ...SAMPLE_RECEIPT,
  kind: "reward",
  number: null,
  business: "Tegata",
  title: "Referral reward for inviting Northwind Ltd",
  amount: "10000000",
  method: "reward",
  payer: "tegata.testnet",
  payerName: "Tegata",
  receiverName: SAMPLE_BUSINESS,
}

export const SAMPLE_ROUTES = [
  { id: "usdt-tron", symbol: "USDT", chain: "Tron", coin: "usdt", chainMark: "tron" },
  { id: "usdc-base", symbol: "USDC", chain: "Base", coin: "usdc", chainMark: "base" },
  { id: "usdt-eth", symbol: "USDT", chain: "Ethereum", coin: "usdt", chainMark: "eth" },
  { id: "usdc-sol", symbol: "USDC", chain: "Solana", coin: "usdc", chainMark: "sol" },
  { id: "usdc-arb", symbol: "USDC", chain: "Arbitrum", coin: "usdc", chainMark: "arb" },
  { id: "btc-btc", symbol: "BTC", chain: "Bitcoin", coin: "btc", chainMark: "btc" },
] as const

// --- invoices ---------------------------------------------------------------------------------------------

const day = (offset: number) => new Date(Date.now() + offset * 24 * HOUR).toISOString().slice(0, 10)

export const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: "c1",
    name: "Northwind Ltd",
    email: "ap@northwind.com",
    address: "1 Harbour Way\nLondon E14",
    taxId: "GB 123 4567 89",
    invoices: 3,
    invoiced: "4120000000",
    paid: "2500000000",
    outstanding: "1620000000",
  },
  {
    id: "c2",
    name: "Kofi Mensah",
    email: "kofi@mensah.studio",
    address: null,
    taxId: null,
    invoices: 1,
    invoiced: "480000000",
    paid: "480000000",
    outstanding: "0",
  },
  {
    id: "c3",
    name: "Hikari Coffee",
    email: null,
    address: "3-1 Jingumae, Tokyo",
    taxId: null,
    invoices: 0,
    invoiced: "0",
    paid: "0",
    outstanding: "0",
  },
]

const row = (over: Partial<InvoiceRow>): InvoiceRow => ({
  id: crypto.randomUUID(),
  number: 1,
  customer: "Northwind Ltd",
  customerId: "c1",
  issueDate: day(-10),
  dueDate: day(4),
  total: "1250000000",
  paid: "0",
  remaining: "1250000000",
  status: "sent",
  token: "h7Kq2mPx9cRt",
  paidAt: null,
  createdAt: ago(10 * 24 * HOUR),
  ...over,
})

export const SAMPLE_INVOICES: InvoiceRow[] = [
  row({ number: 7, status: "viewed", dueDate: day(5) }),
  row({
    number: 6,
    customer: "Hikari Coffee",
    total: "870000000",
    paid: "300000000",
    remaining: "570000000",
    status: "partly_paid",
    dueDate: day(2),
  }),
  row({
    number: 5,
    customer: "Northwind Ltd",
    total: "2000000000",
    remaining: "2000000000",
    status: "overdue",
    dueDate: day(-3),
  }),
  row({
    number: 4,
    customer: "Kofi Mensah",
    total: "480000000",
    paid: "480000000",
    remaining: "0",
    status: "paid",
    paidAt: ago(2 * 24 * HOUR),
  }),
  row({
    number: null,
    customer: "Hikari Coffee",
    total: "120000000",
    remaining: "0",
    status: "draft",
    token: null,
  }),
  row({ number: 3, customer: "Northwind Ltd", total: "640000000", remaining: "0", status: "void" }),
]

export const SAMPLE_INVOICE: InvoiceDetail = {
  invoice: {
    id: "i7",
    number: 7,
    status: "open",
    network: "testnet",
    issueDate: day(-2),
    dueDate: day(12),
    notes: "Thanks for your business. Payment within 14 days, please.",
    discountKind: "percent",
    discountValue: "1000",
    taxBp: 750,
    subtotal: "1492500000",
    discount: "149250000",
    tax: "100740000",
    total: "1443990000",
    allowPartial: true,
    reminders: true,
    repeat: null,
    billFrom: {
      name: SAMPLE_BUSINESS,
      email: "accounts@studiokaze.com",
      address: "12 Market Street\nLagos 100001",
      taxId: "NG-TIN 20381144",
    },
    billTo: {
      name: "Northwind Ltd",
      email: "ap@northwind.com",
      address: "1 Harbour Way\nLondon E14",
      taxId: null,
    },
    sentAt: ago(2 * 24 * HOUR),
    viewedAt: ago(30 * HOUR),
    paidAt: null,
    voidedAt: null,
    scheduleId: null,
  },
  lines: [
    {
      id: "l1",
      description: "Brand identity: logo, seal and colour system",
      quantityMilli: "1000",
      unitPrice: "1200000000",
      amount: "1200000000",
    },
    {
      id: "l2",
      description: "Design hours",
      quantityMilli: "6500",
      unitPrice: "45000000",
      amount: "292500000",
    },
  ],
  events: [
    { id: "e1", kind: "created", detail: null, createdAt: ago(3 * 24 * HOUR) },
    { id: "e2", kind: "sent", detail: { number: "INV-0007" }, createdAt: ago(2 * 24 * HOUR) },
    {
      id: "e3",
      kind: "emailed",
      detail: { to: "ap@northwind.com" },
      createdAt: ago(2 * 24 * HOUR - MIN),
    },
    { id: "e4", kind: "viewed", detail: null, createdAt: ago(30 * HOUR) },
    {
      id: "e5",
      kind: "payment",
      detail: { amount: "500000000", rail: "tegata" },
      createdAt: ago(5 * HOUR),
    },
  ],
  customer: SAMPLE_CUSTOMERS[0] ?? null,
  payments: [
    {
      id: "pp1",
      rail: "tegata",
      status: "succeeded",
      amount: "500000000",
      payer: "northwind.tegata.testnet",
      payerEmail: null,
      txHash: "4a5U",
      error: null,
      settledAt: ago(5 * HOUR),
      createdAt: ago(5 * HOUR),
      receiptToken: "sampleReceipt01",
    },
  ],
  token: "h7Kq2mPx9cRt",
  paidTotal: "500000000",
  remaining: "943990000",
  status: "partly_paid",
  draft: null,
}

// --- pay people -------------------------------------------------------------------------------------------------

const person = (over: Partial<TeamPerson> & Pick<TeamPerson, "id" | "name">): TeamPerson => ({
  email: `${over.name.split(" ")[0]?.toLowerCase()}@studio-kaze.example`,
  role: null,
  amount: "2400000000",
  token: "Mx7Qp2Lr9KdTzA",
  claimed: true,
  invitedAt: ago(3 * 24 * HOUR),
  ready: { state: "none" },
  pending: null,
  setBy: "person",
  ...over,
})

export const SAMPLE_PEOPLE: TeamPerson[] = [
  person({
    id: "0b1c2d3e-0000-4000-8000-000000000001",
    name: "Mei Tanaka",
    role: "Designer",
    ready: { state: "ready", kind: "tegata", accountId: "mei.tegata.testnet" },
  }),
  person({
    id: "0b1c2d3e-0000-4000-8000-000000000002",
    name: "Kofi Mensah",
    role: "Engineer",
    amount: "3100000000",
    ready: { state: "ready", kind: "near", accountId: "kofi-mensah.testnet" },
    pending: {
      kind: "tegata",
      accountId: "kofi.tegata.testnet",
      activatesAt: new Date(Date.now() + 20 * HOUR).toISOString(),
    },
  }),
  person({
    id: "0b1c2d3e-0000-4000-8000-000000000003",
    name: "Sara Okafor",
    role: "Writer",
    amount: "1700000000",
    claimed: false,
  }),
  person({
    id: "0b1c2d3e-0000-4000-8000-000000000004",
    name: "Diego Alvarez",
    role: "Support",
    amount: "1500000000",
    ready: { state: "opening", kind: "tegata", accountId: "diego.tegata.testnet" },
  }),
]

export const SAMPLE_SLIPS: PaySlipRow[] = [
  {
    id: "5a1b0000-0000-4000-8000-000000000001",
    amount: "2400000000",
    label: "Pay · 1–31 Oct 2026",
    paidAt: ago(12 * 24 * HOUR),
  },
  {
    id: "5a1b0000-0000-4000-8000-000000000002",
    amount: "2400000000",
    label: "Pay · 1–30 Sept 2026",
    paidAt: ago(42 * 24 * HOUR),
  },
]

export const SAMPLE_PAYROLL: PayrollOverview = {
  timezone: "Africa/Lagos",
  schedule: { cadence: "monthly", nextPayday: "2026-11-30", label: "Pay · 31 Oct – 30 Nov 2026" },
  emailEnabled: false,
  runs: [
    {
      id: "9c8d0000-0000-4000-8000-000000000001",
      source: "approval",
      payday: "2026-10-31",
      label: "Pay · 1–31 Oct 2026",
      status: "paid",
      total: "5500000000",
      people: 2,
      paidAt: ago(12 * 24 * HOUR),
    },
  ],
}

const runRow = (over: Partial<PayRunRow> & Pick<PayRunRow, "id" | "name">): PayRunRow => ({
  personId: over.id,
  role: null,
  destinationKind: "tegata",
  accountId: null,
  amount: "2400000000",
  status: "included",
  skipReason: null,
  batch: null,
  relayStatus: null,
  txHash: null,
  ...over,
})

export const SAMPLE_RUN: PayRun = {
  id: "9c8d0000-0000-4000-8000-000000000002",
  source: "approval",
  payday: "2026-11-30",
  label: "Pay · 31 Oct – 30 Nov 2026",
  status: "draft",
  total: "5500000000",
  attempt: 1,
  error: null,
  senderId: SAMPLE_ACCOUNT,
  network: "testnet",
  approvedAt: null,
  paidAt: null,
  transactions: [],
  rows: [
    runRow({ id: "1a00-mei", name: "Mei Tanaka", accountId: "mei.tegata.testnet" }),
    runRow({
      id: "1a00-kofi",
      name: "Kofi Mensah",
      amount: "3100000000",
      destinationKind: "near",
      accountId: "kofi-mensah.testnet",
    }),
    runRow({
      id: "1a00-diego",
      name: "Diego Alvarez",
      amount: "1500000000",
      status: "skipped",
      skipReason: "Their Tegata account is still opening",
    }),
    runRow({
      id: "1a00-sara",
      name: "Sara Okafor",
      amount: "1700000000",
      destinationKind: null,
      status: "skipped",
      skipReason: "Hasn't chosen where pay lands",
    }),
  ],
}

export const SAMPLE_PERSON_PAGE: PersonPage = {
  token: "Mx7Qp2Lr9KdTzA",
  name: "Mei Tanaka",
  role: "Designer",
  amount: "2400000000",
  cadence: "monthly",
  business: SAMPLE_BUSINESS,
  logo: null,
  network: "testnet",
  emailHint: "m••@studio-kaze.example",
  claimed: false,
  ready: { state: "none" },
  pending: null,
  slips: [],
}

/** A payslip: the receipt of one person's pay from one run. */
export const SAMPLE_PAYSLIP: ReceiptView = {
  ...SAMPLE_RECEIPT,
  kind: "payslip",
  number: null,
  title: "Pay · 1–31 Oct 2026",
  amount: "2400000000",
  method: "payroll",
  payer: SAMPLE_ACCOUNT,
  payerName: SAMPLE_BUSINESS,
  receiverName: "Mei Tanaka",
  receiverId: "mei.tegata.testnet",
}

// --- autopilot ----------------------------------------------------------------------------------------------------

const DAY = 24 * HOUR
const nextNine = (days: number) => {
  const at = new Date(Date.now() + days * DAY)
  at.setHours(9, 0, 0, 0)
  return at.getTime()
}

export const SAMPLE_AUTOPILOT_ROWS = [
  {
    personId: "0b1c2d3e-0000-4000-8000-000000000001",
    name: "Mei Tanaka",
    role: "Designer",
    destinationKind: "tegata" as const,
    accountId: "mei.tegata.testnet",
    amount: "2400000000",
  },
  {
    personId: "0b1c2d3e-0000-4000-8000-000000000002",
    name: "Kofi Mensah",
    role: "Engineer",
    destinationKind: "near" as const,
    accountId: "kofi-mensah.testnet",
    amount: "3100000000",
  },
]

export const SAMPLE_AUTOPILOT_PREVIEW: AutopilotPreview = {
  cadence: "monthly",
  paydays: ["2026-11-30", "2026-12-31", "2027-01-31"],
  dueMs: [nextNine(18), nextNine(49), nextNine(80)],
  rows: SAMPLE_AUTOPILOT_ROWS,
  left: [
    { name: "Sara Okafor", reason: "Hasn't chosen where pay lands" },
    { name: "Diego Alvarez", reason: "Their account is still getting ready" },
  ],
  total: "5500000000",
  timezone: "Africa/Lagos",
}

const AUTOPILOT_BASE = {
  contract: "pay.tegata.testnet",
  contractUrl: "https://testnet.nearblocks.io/address/pay.tegata.testnet",
  lastId: "a1700000-0000-4000-8000-000000000001",
  timezone: "Africa/Lagos",
}

const autopilotRow = (status: NonNullable<AutopilotView["row"]>["status"]) => ({
  id: "a1700000-0000-4000-8000-000000000001",
  status,
  planId: status === "on" ? "7" : null,
  paydays: SAMPLE_AUTOPILOT_PREVIEW.paydays,
  dueMs: SAMPLE_AUTOPILOT_PREVIEW.dueMs,
  rows: SAMPLE_AUTOPILOT_ROWS,
  total: "5500000000",
  setAside: "11000000000",
  underfunded: null,
  error: null,
})

export const SAMPLE_AUTOPILOT: Record<
  "off" | "setting-up" | "on" | "paused" | "underfunded" | "left-over",
  AutopilotView
> = {
  off: { ...AUTOPILOT_BASE, row: null, funds: null, plan: null },
  "setting-up": { ...AUTOPILOT_BASE, row: autopilotRow("ready"), funds: null, plan: null },
  on: {
    ...AUTOPILOT_BASE,
    row: autopilotRow("on"),
    funds: { available: "11000000000", reserved: "0", inFlight: "0" },
    plan: {
      status: "Active",
      next: 0,
      cursor: 0,
      due: SAMPLE_AUTOPILOT_PREVIEW.dueMs,
      lastPaid: 0,
      lastFailed: 0,
    },
  },
  paused: {
    ...AUTOPILOT_BASE,
    row: autopilotRow("on"),
    funds: { available: "5500000000", reserved: "0", inFlight: "0" },
    plan: {
      status: "Paused",
      next: 1,
      cursor: 0,
      due: SAMPLE_AUTOPILOT_PREVIEW.dueMs,
      lastPaid: 2,
      lastFailed: 0,
    },
  },
  underfunded: {
    ...AUTOPILOT_BASE,
    row: {
      ...autopilotRow("on"),
      underfunded: {
        payday: "2026-11-30",
        needed: "5500000000",
        available: "3000000000",
        at: ago(5 * MIN),
      },
    },
    funds: { available: "3000000000", reserved: "0", inFlight: "0" },
    plan: {
      status: "Active",
      next: 0,
      cursor: 0,
      due: SAMPLE_AUTOPILOT_PREVIEW.dueMs,
      lastPaid: 0,
      lastFailed: 0,
    },
  },
  "left-over": {
    ...AUTOPILOT_BASE,
    row: null,
    funds: { available: "2400000000", reserved: "0", inFlight: "0" },
    plan: null,
  },
}

// --- books --------------------------------------------------------------------------------------------------------

const movement = (
  over: Partial<MovementView> &
    Pick<MovementView, "id" | "kind" | "direction" | "amount" | "title">,
): MovementView => ({
  at: "2026-11-12T16:00:00.000Z",
  counterparty: null,
  counterpartyAccount: null,
  status: "done",
  txHash: "7hEg9DgZdEaq7e4AHtY9FZ4ReB3sveq5XwewiEanCKFr",
  explorerUrl: "https://testnet.nearblocks.io/txns/7hEg9DgZdEaq7e4AHtY9FZ4ReB3sveq5XwewiEanCKFr",
  url: null,
  counted: true,
  refunded: "0",
  refundable: null,
  ...over,
})

export const SAMPLE_BOOKS: BooksMonth = {
  month: "2026-11",
  label: "November 2026",
  timezone: "Africa/Lagos",
  moneyIn: "4012500000",
  moneyOut: "5740000000",
  net: "-1727500000",
  movements: [
    movement({
      id: "b0000000-0000-4000-8000-000000000001",
      kind: "payment_in",
      direction: "in",
      amount: "1250000000",
      title: "Invoice INV-0007",
      counterpartyAccount: "northwind.testnet",
      at: "2026-11-12T17:30:00.000Z",
      url: "/dev/flows/pay",
      refundable: {
        paymentId: "p1",
        left: "1250000000",
        payer: "northwind.testnet",
        rail: "near_wallet",
        assetIn: null,
        route: null,
      },
    }),
    movement({
      id: "b0000000-0000-4000-8000-000000000002",
      kind: "payroll",
      direction: "out",
      amount: "5500000000",
      title: "Payroll · Pay · 1–31 Oct 2026",
      counterparty: "2 people",
      at: "2026-11-12T14:00:00.000Z",
      url: "/dev/flows/payroll",
    }),
    movement({
      id: "b0000000-0000-4000-8000-000000000003",
      kind: "autopilot_set_aside",
      direction: "out",
      amount: "11000000000",
      title: "Set aside in autopilot",
      counterparty: "Autopilot",
      counterpartyAccount: "pay.tegata.testnet",
      at: "2026-11-11T16:00:00.000Z",
      status: "pending",
      counted: true,
    }),
    movement({
      id: "b0000000-0000-4000-8000-000000000004",
      kind: "refund",
      direction: "out",
      amount: "240000000",
      title: "Refund",
      counterpartyAccount: "hikari.testnet",
      at: "2026-11-11T15:00:00.000Z",
    }),
    movement({
      id: "b0000000-0000-4000-8000-000000000005",
      kind: "payment_in",
      direction: "in",
      amount: "2752500000",
      title: "Logo design",
      counterpartyAccount: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
      at: "2026-11-11T14:00:00.000Z",
      refunded: "240000000",
      // Paid from another chain: the refund goes back in USDT on Tron through NEAR Intents.
      refundable: {
        paymentId: "p2",
        left: "2512500000",
        payer: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
        rail: "oneclick",
        assetIn: "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near",
        route: { id: "usdt-tron", symbol: "USDT", chain: "Tron", coin: "usdt", chainMark: "tron" },
      },
    }),
    movement({
      id: "b0000000-0000-4000-8000-000000000006",
      kind: "reward",
      direction: "in",
      amount: "10000000",
      title: "Referral reward: you invited a business",
      counterparty: "Tegata",
      counterpartyAccount: "tegata.testnet",
      at: "2026-11-10T16:00:00.000Z",
    }),
  ],
}

export const SAMPLE_RECONCILIATION: Reconciliation = {
  accountId: SAMPLE_ACCOUNT,
  balance: "5750000",
  checked: 7,
  outside: [
    {
      txHash: "AXFWZVcuwvJW4ceTxcTDYNUt82Ron9s7x3vjAYyS7G7M",
      at: "2026-11-12T08:12:00.000Z",
      delta: "20000000",
      other: "641c8bb12ddfc8f0a1475ed00e84dade985d5f8e40c877f7958e1db0e96234a5",
      explorerUrl:
        "https://testnet.nearblocks.io/txns/AXFWZVcuwvJW4ceTxcTDYNUt82Ron9s7x3vjAYyS7G7M",
    },
  ],
}

// --- developers and counter ---------------------------------------------------------------------------------------

export const SAMPLE_DEVELOPERS: DevelopersView = {
  appUrl: "https://tegata.xyz",
  keys: [
    {
      id: "k1",
      name: "Shop server",
      prefix: "tk_test_mNC-",
      createdAt: "2026-11-11T09:00:00.000Z",
      lastUsedAt: "2026-11-12T08:20:00.000Z",
    },
  ],
  endpoints: [
    {
      id: "e1",
      url: "https://tegata.xyz/api/webhooks/inbox/wn62kD2UzdSjRmBpQ3Ga",
      inbox: true,
      enabled: true,
      secretHint: "whsec_Rk3…",
      createdAt: "2026-11-11T09:01:00.000Z",
    },
    {
      id: "e2",
      url: "https://shop.example/tegata/webhooks",
      inbox: false,
      enabled: true,
      secretHint: "whsec_9xQ…",
      createdAt: "2026-11-11T09:05:00.000Z",
    },
  ],
  deliveries: [
    {
      id: "d1",
      endpointId: "e1",
      eventId: "ev1",
      type: "checkout.session.completed",
      status: "delivered",
      attempts: 1,
      lastStatus: 200,
      lastError: null,
      createdAt: "2026-11-12T08:21:00.000Z",
      payload: JSON.stringify(
        {
          id: "ev1",
          type: "checkout.session.completed",
          data: { id: "2f85…", status: "complete", amount: "$0.25", metadata: { order: "1042" } },
        },
        null,
        2,
      ),
    },
    {
      id: "d2",
      endpointId: "e2",
      eventId: "ev1",
      type: "checkout.session.completed",
      status: "pending",
      attempts: 2,
      lastStatus: 503,
      lastError: "HTTP 503",
      createdAt: "2026-11-12T08:21:00.000Z",
      payload: "{}",
    },
  ],
  inbox: [
    {
      id: "i1",
      type: "checkout.session.completed",
      verified: true,
      webhookId: "msg_d1",
      receivedAt: "2026-11-12T08:21:02.000Z",
    },
    {
      id: "i2",
      type: "payment.succeeded",
      verified: true,
      webhookId: "msg_d0",
      receivedAt: "2026-11-12T08:21:01.000Z",
    },
  ],
}

export const SAMPLE_COUNTER_SALES = [
  {
    id: "c1",
    token: "E32DvMBiifrjmx",
    title: "Two flat whites",
    amount: "9000000",
    status: "paid" as const,
    createdAt: "2026-11-12T08:10:00.000Z",
  },
  {
    id: "c2",
    token: "F43EwNCjjgskny",
    title: "Counter sale",
    amount: "4500000",
    status: "open" as const,
    createdAt: "2026-11-12T08:02:00.000Z",
  },
]

// --- emails (/dev/emails): one sample of every email Tegata sends -------------------------------------------------

const SETTLED = {
  business: "Studio Kaze",
  logo: null,
  sandbox: false,
  timezone: "Africa/Lagos",
  at: "2026-11-13T12:04:00.000Z",
  txHash: "4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX",
  explorerUrl: "https://nearblocks.io/txns/4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX",
}
const PAYMENT = {
  ...SETTLED,
  amount: "1250000000",
  title: "Invoice INV-0007",
  from: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
  paidWith: "USDT on Tron → USDC on NEAR",
  receiptUrl: "/r/sample",
  receiptNumber: 12,
  remaining: null,
  invoiceNumber: "INV-0007",
  ownerUrl: "/app/invoices",
}
const INVOICE = {
  business: "Studio Kaze",
  customer: "Northwind",
  number: "INV-0007",
  total: "1250000000",
  remaining: "1250000000",
  dueDate: "2026-11-30",
  url: "/i/sample",
  notes: "Logo design and brand guide, as agreed. Thank you!",
  sandbox: false,
}
const MOVE = {
  ...SETTLED,
  amount: "240000000",
  counterparty: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
  title: "USDT on Tron",
  receiptUrl: "/r/send/sample",
}

/** Every email kind with believable data, in the order the email audit ranks them. */
export const EMAIL_SAMPLES = [
  { kind: "payment.received", data: PAYMENT },
  { kind: "payment.receipt", data: PAYMENT },
  { kind: "payment.receipt", data: { ...PAYMENT, amount: "500000000", remaining: "750000000" } },
  { kind: "invoice.sent", data: INVOICE },
  { kind: "invoice.reminder", data: { ...INVOICE, offset: 3 } },
  { kind: "invoice.overdue", data: { ...INVOICE, ownerUrl: "/app/invoices", daysLate: 3 } },
  { kind: "invoice.void", data: INVOICE },
  {
    kind: "invoice.paid_by_hand",
    data: {
      ...INVOICE,
      amount: "1250000000",
      note: "Bank transfer, 12 Nov",
      receiptUrl: "/r/sample",
    },
  },
  {
    kind: "payroll.invite",
    data: {
      business: "Studio Kaze",
      person: "Mei",
      role: "Designer",
      amount: "2400000000",
      cadence: "a month",
      url: "/p/sample",
      sandbox: false,
    },
  },
  {
    kind: "payroll.paid",
    data: {
      ...SETTLED,
      person: "Mei",
      amount: "2400000000",
      period: "Pay · 1–30 Nov 2026",
      account: "mei.tegata.near",
      url: "/r/slip/sample",
      autopilot: true,
    },
  },
  {
    kind: "payroll.run",
    data: {
      business: "Studio Kaze",
      sandbox: false,
      status: "paid",
      paid: 3,
      failed: 0,
      total: "7200000000",
      payday: "2026-11-28",
      url: "/app/payroll",
      autopilot: false,
    },
  },
  {
    kind: "payroll.due",
    data: {
      business: "Studio Kaze",
      sandbox: false,
      people: 3,
      total: "7200000000",
      payday: "2026-11-28",
      url: "/app/payroll",
    },
  },
  {
    kind: "destination.pending",
    data: {
      business: "Studio Kaze",
      sandbox: false,
      person: "Mei",
      destination: "mei.near",
      activatesAt: "2026-11-14T10:00:00.000Z",
      timezone: "Africa/Lagos",
      url: "/p/sample",
      to: "person",
    },
  },
  {
    kind: "autopilot.underfunded",
    data: {
      business: "Studio Kaze",
      sandbox: false,
      needed: "7200000000",
      available: "3000000000",
      payday: "2026-11-28",
      url: "/app/payroll",
    },
  },
  {
    kind: "payout.delivered",
    data: {
      ...MOVE,
      delivered: {
        route: "USDT on Tron",
        coin: "usdt",
        chainMark: "tron",
        amountOut: "239.71",
        txUrl: null,
      },
    },
  },
  {
    kind: "payout.returned",
    data: {
      ...MOVE,
      reason: "NEAR Intents couldn't complete the conversion in time.",
      delivered: {
        route: "USDT on Tron",
        coin: "usdt",
        chainMark: "tron",
        amountOut: null,
        txUrl: null,
      },
    },
  },
  { kind: "refund.received", data: { ...MOVE, title: "Refund of Invoice INV-0007" } },
  {
    kind: "send.received",
    data: { ...MOVE, counterparty: "kofi.tegata.near", title: "One-off payment" },
  },
  {
    kind: "referral.paid",
    data: {
      ...MOVE,
      amount: "10000000",
      title: "Referral reward for inviting Northwind",
      other: "Northwind got paid with your link",
      receiptUrl: "/r/reward/sample",
    },
  },
  {
    kind: "account.live",
    data: {
      business: "Studio Kaze",
      accountId: "studio-kaze.tegata.near",
      sandbox: false,
      url: "/app/links",
    },
  },
  {
    kind: "apikey.created",
    data: {
      business: "Studio Kaze",
      sandbox: false,
      name: "Shop checkout",
      prefix: "tk_live_ab12",
      url: "/app/developers",
    },
  },
  {
    kind: "statement.monthly",
    data: {
      business: "Studio Kaze",
      sandbox: false,
      month: "2026-10",
      label: "October 2026",
      moneyIn: "12400000000",
      moneyOut: "9800000000",
      net: "2600000000",
      count: 41,
      url: "/app/activity",
    },
  },
] as const

// --- bank (/dev/flows/bank) ---------------------------------------------------------------------------------------

const BANK_PAYOUT = {
  id: "dev-bank-payout",
  amount: "20000000",
  fiat: "NGN",
  fiatAmount: "26765.50",
  rate: "1351.8",
  fee: "270.5",
  account: "Access Bank ••0031",
  holder: "Forrest Green",
  nearTx: "CGQr6SEf3P5spDqohfH91PGCMABGjA1RGDpiYyczHe6F",
  hopTx: "3Hu2PYu6gKeLLDbSKv4rzJ5Ee7thY955KjDqAgFmviY8YFdpZT7KvHp7bcZh3yYz6EBSmWrWp8KXYrVBGiPP79K1",
  error: null,
  paidAt: "2026-11-13T12:20:00.000Z",
  createdAt: "2026-11-13T12:18:00.000Z",
}

export const SAMPLE_BANK = {
  countries: [
    { code: "NG", fiat: "NGN", name: "Nigeria" },
    { code: "GH", fiat: "GHS", name: "Ghana" },
    { code: "ZA", fiat: "ZAR", name: "South Africa" },
  ],
  saved: [
    {
      id: "dev-acct",
      country: "NG",
      fiat: "NGN",
      label: "Access Bank ••0031",
      holder: "Forrest Green",
    },
    {
      id: "dev-acct-2",
      country: "NG",
      fiat: "NGN",
      label: "Moniepoint Microfinance Bank ••4417",
      holder: "Adaeze Okafor",
    },
  ],
  /** Nigeria's form as Noah sends it (trimmed bank list). */
  schema: {
    type: "object",
    required: ["BankDetails", "PaymentPurpose"],
    properties: {
      BankDetails: {
        type: "object",
        title: "Bank details",
        required: ["AccountNumber", "Bank"],
        properties: {
          AccountNumber: { type: "string", title: "Account number", minLength: 5, maxLength: 30 },
          Bank: {
            type: "string",
            title: "Bank",
            enum: [
              "Access Bank",
              "Guaranty Trust Bank (GTBank)",
              "Zenith bank PLC",
              "First Bank PLC",
              "United Bank for Africa (UBA)",
              "Opay",
              "Moniepoint Microfinance Bank",
              "PalmPay",
              "Kuda",
              "Wema Bank PLC",
              "Abbey Mortgage Bank",
            ],
          },
        },
      },
      PaymentPurpose: { type: "string", title: "Payment purpose" },
      Reference: { type: "string", title: "Reference", maxLength: 180 },
    },
  },
  /** Ghana's form: the holder's name sits in an allOf/if block; South Africa adds contact details. */
  schemaGH: {
    type: "object",
    required: ["BankDetails", "AccountHolderName", "PaymentPurpose"],
    properties: {
      BankDetails: {
        type: "object",
        required: ["AccountNumber", "Bank"],
        properties: {
          AccountNumber: { type: "string", title: "Account number", minLength: 5, maxLength: 30 },
          Bank: {
            type: "string",
            title: "Bank",
            enum: [
              "GCB Bank Limited",
              "Ecobank Ghana (GH130100)",
              "Stanbic Bank Ghana Limited",
              "Fidelity Bank Ghana Ltd.",
              "UNITED BANK FOR AFRICA (GHANA) LTD",
              "OMNIBANK GHANA LIMITED",
            ],
          },
        },
      },
      AccountHolderName: { type: "object", title: "Account holder name" },
      PaymentPurpose: { type: "string", title: "Payment purpose" },
      Reference: { type: "string", title: "Reference", maxLength: 180 },
    },
  },
  schemaZA: {
    type: "object",
    properties: {
      BankDetails: {
        type: "object",
        properties: {
          AccountNumber: { type: "string" },
          Bank: {
            type: "string",
            enum: [
              "Capitec Bank",
              "First National Bank",
              "Standard Bank",
              "ABSA",
              "Nedbank Limited",
              "TYME",
            ],
          },
        },
      },
      AccountHolderName: { type: "object" },
      Email: { type: "string" },
      PhoneNumber: { type: "string" },
      AccountHolderAddress: { type: "object" },
      PaymentPurpose: { type: "string" },
      Reference: { type: "string" },
    },
  },
  quotes: {
    GH: {
      channelId: "dev-gh",
      fiat: "GHS",
      rate: "15.26",
      fiatAmount: "302.15",
      fee: "3.05",
      min: "3.07",
      max: "3571.73",
      seconds: 60,
    },
    ZA: {
      channelId: "dev-za",
      fiat: "ZAR",
      rate: "15.63",
      fiatAmount: "309.48",
      fee: "3.12",
      min: "3.07",
      max: "3571.73",
      seconds: 60,
    },
  },
  quote: {
    channelId: "dev-channel",
    fiat: "NGN",
    rate: "1351.8",
    fiatAmount: "26765.50",
    fee: "270.5",
    min: "1.10",
    max: "3508.52",
    seconds: 50,
  },
  payout: (state: string) => ({
    ...BANK_PAYOUT,
    status:
      state === "paid"
        ? ("paid" as const)
        : state === "failed"
          ? ("failed" as const)
          : state === "sending"
            ? ("paying" as const)
            : ("drafted" as const),
    error:
      state === "failed" ? "Returned to your balance: Noah couldn't pay the bank account" : null,
  }),
  details: {
    fiat: "EUR",
    holder: "Studio Kaze",
    number: "MT89CFTE19870000000090010363160",
    bank: "OPENPAYD FINANCIAL SERVICES MALTA LTD",
    code: "CFTEMTM1XXX",
    rail: "BankSepa",
  },
  deposits: [
    {
      id: "dev-dep-1",
      fiat: "EUR",
      fiatAmount: "2",
      amount: "1162283",
      status: "credited",
      creditTx: "CGQr6SEf3P5spDqohfH91PGCMABGjA1RGDpiYyczHe6F",
      error: null,
      createdAt: "2026-11-13T11:41:00.000Z",
    },
  ],
  recent: [
    { ...BANK_PAYOUT, status: "paid" as const },
    {
      ...BANK_PAYOUT,
      id: "dev-bank-2",
      amount: "5000000",
      fiatAmount: "6488.50",
      status: "paying" as const,
      paidAt: null,
    },
  ],
}
