// Sample names and figures for /dev only (plan 6.9). Nothing outside app/dev imports this file.
import type { LinkDetail, PayLink, PublicRequest, ReceiptView } from "@/lib/client/types"

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
}

export const SAMPLE_RECEIPT: ReceiptView = {
  number: 7,
  business: SAMPLE_BUSINESS,
  logo: null,
  title: "Logo design",
  amount: "1250000000",
  rail: "tegata",
  payer: "northwind.tegata.testnet",
  receiverId: SAMPLE_ACCOUNT,
  network: "testnet",
  settledAt: ago(2 * HOUR),
  txHash: "4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX",
  explorerUrl: "https://testnet.nearblocks.io/txns/4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX",
}

export const SAMPLE_ROUTES = [
  { id: "usdt-tron", symbol: "USDT", chain: "Tron", coin: "usdt", chainMark: "tron" },
  { id: "usdc-base", symbol: "USDC", chain: "Base", coin: "usdc", chainMark: "base" },
  { id: "usdt-eth", symbol: "USDT", chain: "Ethereum", coin: "usdt", chainMark: "eth" },
  { id: "usdc-sol", symbol: "USDC", chain: "Solana", coin: "usdc", chainMark: "sol" },
  { id: "usdc-arb", symbol: "USDC", chain: "Arbitrum", coin: "usdc", chainMark: "arb" },
  { id: "btc-btc", symbol: "BTC", chain: "Bitcoin", coin: "btc", chainMark: "btc" },
] as const
