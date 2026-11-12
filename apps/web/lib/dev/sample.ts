// Sample names and figures for /dev only (plan 6.9). Nothing outside app/dev imports this file.
import type {
  Customer,
  InvoiceDetail,
  InvoiceRow,
  LinkDetail,
  PayLink,
  PublicRequest,
  ReceiptView,
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
