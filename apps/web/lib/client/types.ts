import type { NetworkId } from "@tegata/config"
import type { DelegateDraft } from "@tegata/core/near"

export interface AccountView {
  id: string
  network: NetworkId
  accountId: string
  /** The operator's transaction that created the account on NEAR. */
  createdTx: string | null
  /** The operator's transaction that registered it on USDC. */
  registeredTx: string | null
  readyAt: string | null
  /** USDC base units as a string. */
  balance?: string
}

export interface Profile {
  user: { id: string; email: string | null; handle: string | null; publicKey: string | null }
  workspace?: {
    id: string
    name: string
    timezone: string
    address: string | null
    taxId: string | null
    email: string | null
    /** Where the logo is served, or null. */
    logo: string | null
  }
  accounts: AccountView[]
  networks: NetworkId[]
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

/** Where one attempt to pay a request stands (plan section 2, "Paying in"). */
export type PaymentStatus =
  | "awaiting"
  | "detected"
  | "settling"
  | "succeeded"
  | "refunded"
  | "failed"
  | "expired"

export type PaymentRail = "tegata" | "near_wallet" | "oneclick"

export interface ActivityItem {
  id: string
  /** send: a one-off send · paid: a pay link this person paid · received: a payment into one of their links. */
  kind: "send" | "paid" | "received"
  network: NetworkId
  /** A NEAR account, or the business that was paid. */
  counterparty: string
  /** The pay link's title, for payments. */
  title: string | null
  /** USDC base units as a string. */
  amount: string
  status: RelayStatus["status"] | PaymentStatus
  receiptToken: string | null
  explorerUrl: string | null
  at: string
}

export interface PayLink {
  id: string
  token: string
  title: string
  note: string | null
  /** USDC base units; null when the payer types the amount. */
  amount: string | null
  status: "open" | "paid" | "closed"
  network: NetworkId
  receiverId: string
  paidCount: number
  /** USDC base units. */
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
}

export interface LinkDetail {
  request: PayLink
  payments: LinkPayment[]
}

/** What the public pay page knows: nothing private. */
export interface PublicRequest {
  token: string
  business: string
  /** The business's logo URL, or null (the seal stands in). */
  logo: string | null
  title: string
  note: string | null
  amount: string | null
  status: PayLink["status"]
  network: NetworkId
  receiverId: string
  usdc: string
}

export interface AttemptView {
  id: string
  status: PaymentStatus
  rail: PaymentRail
  relayStatus: RelayStatus["status"] | null
  amount: string
  error: string | null
  receiptToken: string | null
  explorerUrl: string | null
}

export interface TegataAttempt {
  paymentId: string
  relayId: string
  draft: DelegateDraft
  amount: string
  receiverId: string
}

export interface WalletAttempt {
  paymentId: string
  network: NetworkId
  receiverId: string
  amount: string
  memo: string
}

export interface ReceiptView {
  number: number
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
