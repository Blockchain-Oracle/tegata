// Pay by card on the server: Transak's client from env, and whether cards are open on a network.
import type { NetworkId } from "@tegata/config"
import { transakClient } from "@tegata/core/transak"
import { serverEnv } from "@tegata/env"
import { cardNetwork } from "@tegata/services"

let client: ReturnType<typeof transakClient> | null = null

/** Transak's client (the token is cached in it), or null when card payments aren't set up on this server. */
export function transak() {
  const env = serverEnv()
  if (!env.TRANSAK_API_KEY || !env.TRANSAK_API_SECRET) return null
  client ??= transakClient({
    apiKey: env.TRANSAK_API_KEY,
    apiSecret: env.TRANSAK_API_SECRET,
    env: env.TRANSAK_ENV ?? "staging",
  })
  return client
}

/** Whether this network takes cards: staging keys take them in the Sandbox, production keys in Live. */
export function cardsOpen(network: NetworkId) {
  const t = transak()
  return Boolean(t && cardNetwork(t) === network)
}
