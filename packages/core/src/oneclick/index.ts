// NEAR Intents 1Click, server side (plan 6.8 AB; context/09-realworld-money/live-1click-notes.md): non-dry quotes for
// Live pay-ins and payouts, the status of a deposit address, and the check that a quote really came from 1Click.
// No SDK: the SDK pulls in axios; the signature check is a few lines, mirrored from its `quote-signature.ts`.
import { sha256 } from "@noble/hashes/sha2.js"
import { base58 } from "@scure/base"
import { PublicKey } from "near-api-js"

export const ONECLICK_BASE = "https://1click.chaindefuser.com"
/** 1Click's quote-signing key (SDK 0.1.26 `ONE_CLICK_MANAGER_PUB_KEY`). */
export const ONECLICK_MANAGER_KEY = "ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc"

export interface QuoteRequest {
  dry: boolean
  swapType: "EXACT_INPUT" | "EXACT_OUTPUT"
  slippageTolerance: number
  originAsset: string
  depositType: "ORIGIN_CHAIN" | "INTENTS"
  destinationAsset: string
  amount: string
  refundTo: string
  refundType: "ORIGIN_CHAIN" | "INTENTS"
  recipient: string
  recipientType: "DESTINATION_CHAIN" | "INTENTS"
  /** When refunds begin if the swap hasn't completed: the payer's cut-off. */
  deadline: string
  [key: string]: unknown
}

export interface Quote {
  amountIn: string
  amountInFormatted: string
  amountInUsd: string
  minAmountIn: string
  amountOut: string
  amountOutFormatted: string
  amountOutUsd: string
  minAmountOut: string
  depositAddress?: string
  depositMemo?: string
  deadline?: string
  timeWhenInactive?: string
  timeEstimate?: number
  refundFee?: string
  withdrawFee?: string
}

export interface QuoteResponse {
  quote: Quote
  /** 1Click's echo of the request, normalised: what the signature covers (never the body we sent). */
  quoteRequest: QuoteRequest
  signature: string
  timestamp: string
  correlationId?: string
}

export type SwapStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED"

export interface StatusResponse {
  status: SwapStatus | string
  updatedAt?: string
  quoteResponse?: QuoteResponse
  swapDetails?: {
    originChainTxHashes?: { hash: string; explorerUrl?: string }[]
    destinationChainTxHashes?: { hash: string; explorerUrl?: string }[]
    nearTxHashes?: string[]
    depositedAmount?: string
    depositedAmountFormatted?: string
    refundedAmount?: string
    refundedAmountFormatted?: string
    refundReason?: string
  }
}

/** Terminal: nothing more will happen. Anything else (including a status we don't know) keeps being polled. */
export const isTerminal = (status: string) =>
  status === "SUCCESS" || status === "REFUNDED" || status === "FAILED"

export class OneClickError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message)
  }
}

const headers = (apiKey?: string) => ({
  "content-type": "application/json",
  ...(apiKey ? { "x-api-key": apiKey } : {}),
})

export async function requestQuote(body: QuoteRequest, apiKey?: string): Promise<QuoteResponse> {
  const response = await fetch(`${ONECLICK_BASE}/v0/quote`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const data = (await response.json().catch(() => ({}))) as QuoteResponse & { message?: string }
  if (!response.ok || !data.quote)
    throw new OneClickError(
      data.message ?? `1Click quote: HTTP ${response.status}`,
      response.status,
    )
  return data
}

/** Where a deposit address is; null when 1Click doesn't know it. */
export async function swapStatus(
  depositAddress: string,
  apiKey?: string,
): Promise<StatusResponse | null> {
  const url = `${ONECLICK_BASE}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`
  const response = await fetch(url, { headers: headers(apiKey), cache: "no-store" })
  if (response.status === 404) return null
  if (!response.ok)
    throw new OneClickError(`1Click status: HTTP ${response.status}`, response.status)
  return (await response.json()) as StatusResponse
}

/** Tell 1Click about a deposit transaction so it's picked up sooner (optional, best effort). */
export async function submitDeposit(
  input: { txHash: string; depositAddress: string; nearSenderAccount?: string },
  apiKey?: string,
): Promise<void> {
  await fetch(`${ONECLICK_BASE}/v0/deposit/submit`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(input),
  }).catch(() => undefined)
}

// --- the quote's signature ---------------------------------------------------------------------------------------

/** json-stable-stringify: sorted keys, undefined values left out. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value))
    return `[${value.map((v) => (v === undefined ? "null" : stableStringify(v))).join(",")}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const truthy = (value: unknown) => (value ? value : undefined)

function signedRequest(request: QuoteRequest) {
  return {
    dry: request.dry,
    swapType: request.swapType,
    slippageTolerance: request.slippageTolerance,
    originAsset: request.originAsset,
    depositType: request.depositType,
    destinationAsset: request.destinationAsset,
    amount: request.amount,
    refundTo: request.refundTo,
    refundType: request.refundType,
    recipient: request.recipient,
    recipientType: request.recipientType,
    deadline: request.deadline,
    quoteWaitingTimeMs: truthy(request.quoteWaitingTimeMs),
    referral: truthy(request.referral),
    virtualChainRecipient: truthy(request.virtualChainRecipient),
    virtualChainRefundRecipient: truthy(request.virtualChainRefundRecipient),
    customRecipientMsg: truthy(request.customRecipientMsg),
  }
}

function signedQuote(response: QuoteResponse) {
  const q = response.quote
  const base = {
    amountIn: q.amountIn,
    amountInFormatted: q.amountInFormatted,
    amountInUsd: q.amountInUsd,
    minAmountIn: q.minAmountIn,
    amountOut: q.amountOut,
    amountOutFormatted: q.amountOutFormatted,
    amountOutUsd: q.amountOutUsd,
    minAmountOut: q.minAmountOut,
  }
  if (response.quoteRequest.dry) return base
  return {
    ...base,
    depositAddress: truthy(q.depositAddress),
    depositMemo: truthy(q.depositMemo),
    deadline: truthy(q.deadline),
    timeWhenInactive: truthy(q.timeWhenInactive),
    timeEstimate: truthy(q.timeEstimate),
    refundFee: truthy(q.refundFee),
    withdrawFee: truthy(q.withdrawFee),
  }
}

/** True when 1Click signed exactly this quote (the deposit address included). */
export function verifyQuote(response: QuoteResponse, managerKey = ONECLICK_MANAGER_KEY): boolean {
  try {
    const data = stableStringify({
      ...signedRequest(response.quoteRequest),
      ...signedQuote(response),
      timestamp: response.timestamp,
    })
    const message = new TextEncoder().encode(base58.encode(sha256(new TextEncoder().encode(data))))
    const signature = base58.decode(response.signature.replace(/^ed25519:/, ""))
    return PublicKey.fromString(managerKey).verify(message, signature)
  } catch {
    return false
  }
}

// --- names for 1Click assets -------------------------------------------------------------------------------------

/** 1Click's chain codes, as people say them. */
export const CHAIN_NAMES: Record<string, string> = {
  eth: "Ethereum",
  base: "Base",
  arb: "Arbitrum",
  sol: "Solana",
  btc: "Bitcoin",
  tron: "Tron",
  bsc: "BNB Chain",
  pol: "Polygon",
  gnosis: "Gnosis",
  op: "Optimism",
  avax: "Avalanche",
  near: "NEAR",
  ton: "TON",
  sui: "Sui",
  xrp: "XRP Ledger",
  doge: "Dogecoin",
  ltc: "Litecoin",
  zec: "Zcash",
  stellar: "Stellar",
  aptos: "Aptos",
  bera: "Berachain",
}

const TOKENS_TTL_MS = 10 * 60_000
let tokenCache: {
  at: number
  list: { assetId: string; symbol: string; blockchain: string }[]
} | null = null

/** "USDT" on "Tron" for a 1Click asset id (the token list, cached ten minutes); null when 1Click doesn't list it. */
export async function assetLabel(
  assetId: string,
): Promise<{ symbol: string; chain: string } | null> {
  if (!tokenCache || Date.now() - tokenCache.at > TOKENS_TTL_MS) {
    const response = await fetch(`${ONECLICK_BASE}/v0/tokens`)
    if (!response.ok)
      throw new OneClickError(`1Click tokens: HTTP ${response.status}`, response.status)
    tokenCache = { at: Date.now(), list: await response.json() }
  }
  const token = tokenCache.list.find((t) => t.assetId === assetId)
  return token
    ? { symbol: token.symbol, chain: CHAIN_NAMES[token.blockchain] ?? token.blockchain }
    : null
}
