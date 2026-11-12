import { NETWORKS, type NetworkId } from "@tegata/config"
import { FailoverRpcProvider, JsonRpcProvider, type Provider } from "near-api-js"

const providers = new Map<NetworkId, Provider>()

/** One RPC client per network, falling over to the next endpoint when a call fails. */
export function nearProvider(network: NetworkId): Provider {
  let provider = providers.get(network)
  if (!provider) {
    provider = new FailoverRpcProvider(
      NETWORKS[network].rpcUrls.map((url) => new JsonRpcProvider({ url })),
    )
    providers.set(network, provider)
  }
  return provider
}

const primaries = new Map<NetworkId, JsonRpcProvider>()

/**
 * The first endpoint on its own, with no failover. For questions where "no" is a normal
 * answer (does this account exist?), so one refusal is not retried on every endpoint.
 */
export function primaryProvider(network: NetworkId): JsonRpcProvider {
  let provider = primaries.get(network)
  if (!provider) {
    const [url] = NETWORKS[network].rpcUrls
    if (!url) throw new Error(`No RPC endpoint for ${network}`)
    provider = new JsonRpcProvider({ url })
    primaries.set(network, provider)
  }
  return provider
}

/** Call a read-only contract method. Returns `undefined` when the method returns nothing. */
export async function view<T>(
  network: NetworkId,
  contractId: string,
  method: string,
  args: Record<string, unknown> = {},
): Promise<T | undefined> {
  const result = await nearProvider(network).callFunction({ contractId, method, args })
  return result as T | undefined
}

export function explorerTx(network: NetworkId, hash: string): string {
  return `${NETWORKS[network].explorer}/txns/${hash}`
}

export function explorerAccount(network: NetworkId, accountId: string): string {
  return `${NETWORKS[network].explorer}/address/${accountId}`
}
