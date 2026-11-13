// NEAR Intents 1Click: coins and chains are read
// from /v0/tokens at run time; prices for the landing calculator are dry EXACT_OUTPUT quotes (the business receives
// exactly the amount; the payer's side carries the route cost). A dry quote never creates a deposit address.
import { NETWORKS } from "@tegata/config"

import { PAYER_ROUTES, type PayerRoute } from "@/lib/routes"

export { PAYER_ROUTES, type PayerRoute }

const BASE = "https://1click.chaindefuser.com"
const TOKENS_TTL_S = 300
const QUOTE_TTL_MS = 30_000
const QUOTE_DEADLINE_MS = 30 * 60_000
const SLIPPAGE_BPS = 100
/** Dry quotes need syntactically valid parties; nothing is ever sent. `intents.near` is the Intents contract. */
const DRY_PARTY = "intents.near"

export interface OneClickToken {
  assetId: string
  decimals: number
  blockchain: string
  symbol: string
  price: number
  /** The token's contract on its own chain; absent for a chain's native coin. */
  contractAddress?: string
}

export async function tokens(): Promise<OneClickToken[]> {
  const response = await fetch(`${BASE}/v0/tokens`, { next: { revalidate: TOKENS_TTL_S } })
  if (!response.ok) throw new Error(`1Click tokens: ${response.status}`)
  return (await response.json()) as OneClickToken[]
}

export interface DryQuote {
  route: PayerRoute["id"]
  amountIn: string
  amountInFormatted: string
  amountInUsd: string
  minAmountIn: string | null
  timeEstimate: number
  quotedAt: string
}

export class QuoteRefused extends Error {}

const cache = new Map<string, { at: number; quote: DryQuote }>()

/** What a payer on `route` sends so the business receives exactly `units` of native USDC on NEAR mainnet. */
export async function dryQuote(route: PayerRoute, units: bigint): Promise<DryQuote> {
  const key = `${route.id}:${units}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < QUOTE_TTL_MS) return hit.quote

  const list = await tokens()
  const origin = list.find((t) => t.blockchain === route.blockchain && t.symbol === route.symbol)
  if (!origin) throw new QuoteRefused(`${route.symbol} on ${route.chain} isn't offered right now`)

  const response = await fetch(`${BASE}/v0/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      dry: true,
      swapType: "EXACT_OUTPUT",
      slippageTolerance: SLIPPAGE_BPS,
      originAsset: origin.assetId,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: `nep141:${NETWORKS.mainnet.usdc}`,
      amount: units.toString(),
      refundTo: DRY_PARTY,
      refundType: "INTENTS",
      recipient: DRY_PARTY,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Date.now() + QUOTE_DEADLINE_MS).toISOString(),
    }),
  })
  const body = (await response.json().catch(() => ({}))) as {
    message?: string
    quote?: {
      amountIn: string
      amountInFormatted: string
      amountInUsd: string
      minAmountIn?: string
      timeEstimate: number
    }
  }
  if (!response.ok || !body.quote)
    throw new QuoteRefused(body.message ?? "No route for that amount right now")
  const quote: DryQuote = {
    route: route.id,
    amountIn: body.quote.amountIn,
    amountInFormatted: body.quote.amountInFormatted,
    amountInUsd: body.quote.amountInUsd,
    minAmountIn: body.quote.minAmountIn ?? null,
    timeEstimate: body.quote.timeEstimate,
    quotedAt: new Date().toISOString(),
  }
  cache.set(key, { at: Date.now(), quote })
  return quote
}

/** EVM chain ids for EIP-681 links. */
const EVM_CHAIN_ID: Record<string, number> = {
  eth: 1,
  base: 8453,
  arb: 42161,
  bsc: 56,
  pol: 137,
  gnosis: 100,
}

/**
 * A payment link a wallet can open from a QR: EIP-681 on EVM chains,
 * BIP-21 on Bitcoin, Solana Pay for SOL. Null where no reliable standard exists (Tron, and SPL USDC to a fresh Solana
 * address, which Solana Pay can't fund): the page then shows the plain address.
 */
export function payUri(
  token: OneClickToken,
  depositAddress: string,
  amountIn: string,
  amountInFormatted: string,
): string | null {
  const chainId = EVM_CHAIN_ID[token.blockchain]
  if (chainId) {
    return token.contractAddress
      ? `ethereum:${token.contractAddress}@${chainId}/transfer?address=${depositAddress}&uint256=${amountIn}`
      : `ethereum:${depositAddress}@${chainId}?value=${amountIn}`
  }
  if (token.blockchain === "btc")
    return `bitcoin:${depositAddress}?amount=${amountInFormatted}&label=Tegata`
  if (token.blockchain === "sol" && !token.contractAddress)
    return `solana:${depositAddress}?amount=${amountInFormatted}&label=Tegata`
  return null
}

/** The payer route and its 1Click token, by route id. */
export async function routeToken(routeId: string) {
  const route = PAYER_ROUTES.find((r) => r.id === routeId)
  if (!route) return null
  const token = (await tokens()).find(
    (t) => t.blockchain === route.blockchain && t.symbol === route.symbol,
  )
  return token ? { route, token } : null
}

/** The route a 1Click asset id belongs to (for a payment already started). */
export async function routeOfAsset(assetId: string) {
  const token = (await tokens()).find((t) => t.assetId === assetId)
  const route = token
    ? PAYER_ROUTES.find((r) => r.blockchain === token.blockchain && r.symbol === token.symbol)
    : undefined
  return token && route ? { route, token } : null
}
