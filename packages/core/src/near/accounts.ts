import { LIMITS, NETWORKS, type NetworkId, RESERVED_HANDLES } from "@tegata/config"

import { nearProvider, primaryProvider } from "./provider.ts"

/** `zainab` → `zainab.tegata.near` (or `.tegata.testnet`). */
export function accountIdFor(network: NetworkId, handle: string): string {
  return `${handle}.${NETWORKS[network].operator}`
}

const HANDLE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Why a handle cannot be used, or `null` when it is fine. Does not check the chain. */
export function handleProblem(handle: string): string | null {
  if (handle.length < LIMITS.handleMinLength) return "Too short"
  if (handle.length > LIMITS.handleMaxLength) return "Too long"
  if (!HANDLE_PATTERN.test(handle)) return "Use lowercase letters, numbers and single dashes"
  if (RESERVED_HANDLES.includes(handle)) return "That name is reserved"
  return null
}

/** Turn a business or person's name into a handle suggestion: "Zainab & Co." → "zainab-co". */
export function suggestHandle(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.handleMaxLength)
}

export async function accountExists(network: NetworkId, accountId: string): Promise<boolean> {
  try {
    await primaryProvider(network).viewAccount({ accountId })
    return true
  } catch (error) {
    if (isUnknownAccount(error)) return false
    // The first endpoint is unwell: ask the others before giving up.
    try {
      await nearProvider(network).viewAccount({ accountId })
      return true
    } catch (fallbackError) {
      if (isUnknownAccount(fallbackError)) return false
      throw fallbackError
    }
  }
}

/**
 * True when the chain said the account does not exist. The failover provider wraps that
 * answer in a "retries exceeded" error after trying the other endpoints, so look inside it.
 */
function isUnknownAccount(error: unknown): boolean {
  const nested = (error as { errors?: unknown[] } | null)?.errors
  const all = [error, ...(Array.isArray(nested) ? nested : [])]
  return all.some((entry) => {
    const text = entry instanceof Error ? `${entry.name} ${entry.message}` : String(entry)
    return /UNKNOWN_ACCOUNT|AccountDoesNotExist|does not exist|doesn't exist/i.test(text)
  })
}

/** Yocto balance of an account, or 0 when it does not exist. */
export async function nearBalance(network: NetworkId, accountId: string): Promise<bigint> {
  try {
    const account = await primaryProvider(network).viewAccount({ accountId })
    return BigInt(account.amount)
  } catch (error) {
    if (isUnknownAccount(error)) return 0n
    throw error
  }
}
