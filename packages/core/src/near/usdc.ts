import { GAS, NETWORKS, type NetworkId, ONE_YOCTO, USDC_STORAGE_YOCTO } from "@tegata/config"

import { type CallSpec, call } from "./calls.ts"
import { view } from "./provider.ts"

/** A NEP-141 balance in base units. */
export async function tokenBalance(
  network: NetworkId,
  token: string,
  accountId: string,
): Promise<bigint> {
  const balance = await view<string>(network, token, "ft_balance_of", { account_id: accountId })
  return BigInt(balance ?? "0")
}

export function usdcBalance(network: NetworkId, accountId: string): Promise<bigint> {
  return tokenBalance(network, NETWORKS[network].usdc, accountId)
}

/** True when the account can receive the token (NEP-145 storage is registered). */
export async function isRegistered(
  network: NetworkId,
  token: string,
  accountId: string,
): Promise<boolean> {
  const balance = await view<{ total: string } | null>(network, token, "storage_balance_of", {
    account_id: accountId,
  })
  return balance != null
}

/** `ft_transfer`: moves tokens and fails cleanly if the receiver is not registered. */
export function ftTransfer(receiverId: string, amount: bigint, memo?: string): CallSpec {
  return call(
    "ft_transfer",
    { receiver_id: receiverId, amount: amount.toString(), ...(memo ? { memo } : {}) },
    GAS.ftTransfer,
    ONE_YOCTO,
  )
}

/** Registers an account on a token. Only ever sent by the operator, never inside a relayed action. */
export function storageDeposit(accountId: string): CallSpec {
  return call(
    "storage_deposit",
    { account_id: accountId, registration_only: true },
    GAS.storageDeposit,
    USDC_STORAGE_YOCTO,
  )
}
