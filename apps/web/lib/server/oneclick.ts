// NEAR Intents 1Click (plan R4, context/02-intents-and-chain-abstraction/1click-api.md): coins and chains are read
// from /v0/tokens at run time; prices for the landing calculator are dry EXACT_OUTPUT quotes (the business receives
// exactly the amount; the payer's side carries the route cost). A dry quote never creates a deposit address.
import { NETWORKS } from "@tegata/config"

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
}

/** The routes a payer is most likely to hold, in the order the calculator shows them. Mark ids match public/marks. */
export const PAYER_ROUTES = [
  {
    id: "usdt-tron",
    symbol: "USDT",
    blockchain: "tron",
    chain: "Tron",
    coin: "usdt",
    chainMark: "tron",
  },
  {
    id: "usdc-base",
    symbol: "USDC",
    blockchain: "base",
    chain: "Base",
    coin: "usdc",
    chainMark: "base",
  },
  {
    id: "usdt-eth",
    symbol: "USDT",
    blockchain: "eth",
    chain: "Ethereum",
    coin: "usdt",
    chainMark: "eth",
  },
  {
    id: "usdc-sol",
    symbol: "USDC",
    blockchain: "sol",
    chain: "Solana",
    coin: "usdc",
    chainMark: "sol",
  },
  {
    id: "usdc-arb",
    symbol: "USDC",
    blockchain: "arb",
    chain: "Arbitrum",
    coin: "usdc",
    chainMark: "arb",
  },
  {
    id: "btc-btc",
    symbol: "BTC",
    blockchain: "btc",
    chain: "Bitcoin",
    coin: "btc",
    chainMark: "btc",
  },
  {
    id: "eth-eth",
    symbol: "ETH",
    blockchain: "eth",
    chain: "Ethereum",
    coin: "eth",
    chainMark: "eth",
  },
  {
    id: "sol-sol",
    symbol: "SOL",
    blockchain: "sol",
    chain: "Solana",
    coin: "sol",
    chainMark: "sol",
  },
  {
    id: "usdt-bsc",
    symbol: "USDT",
    blockchain: "bsc",
    chain: "BNB Chain",
    coin: "usdt",
    chainMark: "bnb",
  },
  {
    id: "usdc-pol",
    symbol: "USDC",
    blockchain: "pol",
    chain: "Polygon",
    coin: "usdc",
    chainMark: "pol",
  },
] as const

export type PayerRoute = (typeof PAYER_ROUTES)[number]

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
