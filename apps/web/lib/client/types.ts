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
  workspace?: { id: string; name: string; timezone: string }
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

export interface ActivityItem {
  id: string
  kind: "send"
  network: "mainnet" | "testnet"
  counterparty: string
  /** USDC base units as a string. */
  amount: string
  status: RelayStatus["status"]
  explorerUrl: string | null
  at: string
}
