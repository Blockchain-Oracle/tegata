// What the API returns, as the phone reads it. A subset of apps/web/lib/client/types.ts (same field names and
// meanings); money is always USDC base units as a string.
import type { DelegateDraft, NetworkId } from "@/near/draft"

export type { NetworkId }

export interface AccountView {
  id: string
  network: NetworkId
  accountId: string
  createdTx: string | null
  registeredTx: string | null
  readyAt: string | null
  balance?: string
}

export interface Profile {
  user: {
    id: string
    email: string | null
    handle: string | null
    publicKey: string | null
    walletAccountId?: string | null
    walletNetwork?: NetworkId | null
  }
  workspace?: {
    id: string
    name: string
    timezone: string
    address: string | null
    taxId: string | null
    email: string | null
    logo: string | null
  } | null
  accounts: AccountView[]
  networks: NetworkId[]
  emailEnabled?: boolean
}

export interface RelayStatus {
  id: string
  status: "drafted" | "signed" | "sent" | "success" | "failed" | "unknown" | "expired"
  error: string | null
  txHash: string | null
  explorerUrl: string | null
}

export interface SendDraft {
  relayId: string
  draft: DelegateDraft
  to: string
  amount: string
}

export type PaymentStatus = "awaiting" | "detected" | "settling" | "succeeded" | "refunded" | "failed" | "expired"
export type PaymentRail = "tegata" | "near_wallet" | "oneclick" | "manual" | "card"

export interface ActivityItem {
  id: string
  kind: "send" | "paid" | "received" | "reward" | "payroll" | "payslip"
  network: NetworkId
  counterparty: string
  title: string | null
  amount: string
  status: RelayStatus["status"] | PaymentStatus | string
  receiptUrl: string | null
  at: string
  rail?: PaymentRail | null
  assetIn?: string | null
}

export interface PayLink {
  id: string
  token: string
  title: string
  note: string | null
  amount: string | null
  status: "open" | "paid" | "closed"
  network: NetworkId
  receiverId: string
  paidCount: number
  paidTotal: string
  createdAt: string
}

export interface LinkPayment {
  id: string
  rail: PaymentRail
  status: PaymentStatus
  amount: string
  payer: string | null
  payerEmail: string | null
  txHash: string | null
  error: string | null
  settledAt: string | null
  createdAt: string
  receiptToken: string | null
  assetIn?: string | null
}

export interface LinkDetail {
  request: PayLink
  payments: LinkPayment[]
}

export type DestinationKind = "tegata" | "near" | "chain"

export interface TeamPerson {
  id: string
  name: string
  role: string | null
  ready: { state: "ready"; kind: DestinationKind; accountId: string } | { state: string; kind?: DestinationKind; accountId?: string }
}

export interface PayRunSummary {
  id: string
  label: string
  payday: string
  status: "draft" | "approved" | "paid" | "failed"
  total: string
  people: number
  source?: "approval" | "autopilot"
}

export interface PayrollOverview {
  timezone: string
  schedule: { cadence: string; nextPayday: string; label: string } | null
  runs: PayRunSummary[]
  emailEnabled: boolean
}

export interface PayRunRow {
  id: string
  personId: string
  name: string
  role: string | null
  destinationKind: DestinationKind | null
  accountId: string | null
  route?: string | null
  amount: string
  status: "included" | "excluded" | "skipped" | "paid" | "failed"
  skipReason: string | null
  batch: number | null
  relayStatus: RelayStatus["status"] | null
  txHash: string | null
}

export interface PayRun {
  id: string
  source: "approval" | "autopilot"
  payday: string
  label: string
  status: "draft" | "approved" | "paid" | "failed"
  total: string
  attempt: number
  error: string | null
  senderId: string
  network: NetworkId
  approvedAt: string | null
  paidAt: string | null
  transactions: { hash: string; url: string }[]
  rows: PayRunRow[]
}

export interface RunBatchDraft {
  relayId: string
  draft: DelegateDraft
  rows: {
    id: string
    accountId: string
    amount: string
    memo: string | null
    via: { route: string; recipient: string; amountOut: string | null } | null
  }[]
}

export interface PaymentReceipt {
  number: number | null
  business: string
  logo: string | null
  title: string
  amount: string
  rail: PaymentRail
  payer: string | null
  receiverId: string
  network: NetworkId
  settledAt: string | null
  txHash: string | null
  explorerUrl: string | null
}

export interface HandleCheck {
  handle: string
  available: boolean
  problem: string | null
}
