// The coins and chains Tegata offers through NEAR Intents, shared by the server (quotes, pay-ins, payouts) and the
// screens (route grids, address checks, explorer links). Mark ids match public/marks.

/** The routes a payer is most likely to hold, and a payee most likely to want, in the order the screens show them. */
export const PAYER_ROUTES = [
  {
    id: "usdt-tron",
    /** NEAR Intents' id for this coin on this chain. */
    assetId: "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near",
    symbol: "USDT",
    blockchain: "tron",
    chain: "Tron",
    coin: "usdt",
    chainMark: "tron",
  },
  {
    id: "usdc-base",
    assetId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    symbol: "USDC",
    blockchain: "base",
    chain: "Base",
    coin: "usdc",
    chainMark: "base",
  },
  {
    id: "usdt-eth",
    assetId: "nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near",
    symbol: "USDT",
    blockchain: "eth",
    chain: "Ethereum",
    coin: "usdt",
    chainMark: "eth",
  },
  {
    id: "usdc-sol",
    assetId: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
    symbol: "USDC",
    blockchain: "sol",
    chain: "Solana",
    coin: "usdc",
    chainMark: "sol",
  },
  {
    id: "usdc-arb",
    assetId: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
    symbol: "USDC",
    blockchain: "arb",
    chain: "Arbitrum",
    coin: "usdc",
    chainMark: "arb",
  },
  {
    id: "btc-btc",
    assetId: "nep141:btc.omft.near",
    symbol: "BTC",
    blockchain: "btc",
    chain: "Bitcoin",
    coin: "btc",
    chainMark: "btc",
  },
  {
    id: "eth-eth",
    assetId: "nep141:eth.omft.near",
    symbol: "ETH",
    blockchain: "eth",
    chain: "Ethereum",
    coin: "eth",
    chainMark: "eth",
  },
  {
    id: "sol-sol",
    assetId: "nep141:sol.omft.near",
    symbol: "SOL",
    blockchain: "sol",
    chain: "Solana",
    coin: "sol",
    chainMark: "sol",
  },
  {
    id: "usdt-bsc",
    assetId: "nep141:bnb-0x55d398326f99059ff775485246999027b3197955.omdep.near",
    symbol: "USDT",
    blockchain: "bsc",
    chain: "BNB Chain",
    coin: "usdt",
    chainMark: "bnb",
  },
  {
    id: "usdc-pol",
    assetId: "nep141:pol-0x3c499c542cef5e3811e1192ce70d8cc03d5c3359.omdep.near",
    symbol: "USDC",
    blockchain: "pol",
    chain: "Polygon",
    coin: "usdc",
    chainMark: "pol",
  },
  // USDC.e on Gnosis: the coin a Gnosis Pay card account (a Safe on Gnosis) spends, so a payout here tops up a card.
  {
    id: "usdc-gnosis",
    assetId: "nep141:gnosis-0x2a22f9c3b484c3629090feed35f17ff8f88f76f0.omft.near",
    symbol: "USDC",
    blockchain: "gnosis",
    chain: "Gnosis",
    coin: "usdc",
    chainMark: "gnosis",
  },
  {
    id: "usdc-eth",
    assetId: "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
    symbol: "USDC",
    blockchain: "eth",
    chain: "Ethereum",
    coin: "usdc",
    chainMark: "eth",
  },
  {
    id: "usdc-bsc",
    assetId: "nep141:bnb-0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d.omdep.near",
    symbol: "USDC",
    blockchain: "bsc",
    chain: "BNB Chain",
    coin: "usdc",
    chainMark: "bnb",
  },
  {
    id: "usdc-avax",
    assetId: "nep141:avax-0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e.omdep.near",
    symbol: "USDC",
    blockchain: "avax",
    chain: "Avalanche",
    coin: "usdc",
    chainMark: "avax",
  },
  {
    id: "usdc-sui",
    assetId: "nep141:sui-c1b81ecaf27933252d31a963bc5e9458f13c18ce.omft.near",
    symbol: "USDC",
    blockchain: "sui",
    chain: "Sui",
    coin: "usdc",
    chainMark: "sui",
  },
  {
    id: "usdt-sol",
    assetId: "nep141:sol-c800a4bd850783ccb82c2b2c7e84175443606352.omft.near",
    symbol: "USDT",
    blockchain: "sol",
    chain: "Solana",
    coin: "usdt",
    chainMark: "sol",
  },
  {
    id: "usdt-pol",
    assetId: "nep141:pol-0xc2132d05d31c914a87c6611c10748aeb04b58e8f.omdep.near",
    symbol: "USDT",
    blockchain: "pol",
    chain: "Polygon",
    coin: "usdt",
    chainMark: "pol",
  },
  // USDT0: Tether's own USDT on Arbitrum (the omnichain version), the one Arbitrum wallets hold today.
  {
    id: "usdt0-arb",
    assetId: "nep141:arb-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9.omft.near",
    symbol: "USDT0",
    blockchain: "arb",
    chain: "Arbitrum",
    coin: "usdt",
    chainMark: "arb",
  },
  {
    id: "usdt-avax",
    assetId: "nep141:avax-0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7.omdep.near",
    symbol: "USDT",
    blockchain: "avax",
    chain: "Avalanche",
    coin: "usdt",
    chainMark: "avax",
  },
  {
    id: "usdt-gnosis",
    assetId: "nep141:gnosis-0x4ecaba5870353805a9f068101a40e0f32ed605c6.omft.near",
    symbol: "USDT",
    blockchain: "gnosis",
    chain: "Gnosis",
    coin: "usdt",
    chainMark: "gnosis",
  },
] as const

export type PayerRoute = (typeof PAYER_ROUTES)[number]

/** How many routes and chains, for copy that counts them (never typed by hand). */
export const ROUTE_COUNT = PAYER_ROUTES.length
export const CHAIN_COUNT = new Set(PAYER_ROUTES.map((r) => r.chainMark)).size

/** Dollar coins: a quote between them can use a tight slippage, and a payout in one arrives at an exact amount. */
export { isStableSymbol as isStable } from "@tegata/config"

/** The route for a payout already made (stored by coin and chain name). */
export const routeOf = (symbol: string | null, chain: string | null) =>
  PAYER_ROUTES.find((r) => r.symbol === symbol && r.chain === chain) ?? null

/** What an address looks like on each chain, as a placeholder. */
export const ADDRESS_HINT: Record<string, string> = {
  eth: "0x…",
  base: "0x…",
  arb: "0x…",
  bnb: "0x…",
  pol: "0x…",
  gnosis: "0x… (a Gnosis Pay card account works)",
  avax: "0x…",
  sui: "0x… (64 characters)",
  sol: "Their Solana address",
  btc: "bc1…",
  tron: "T…",
}

const EVM = /^0x[0-9a-fA-F]{40}$/
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/

/**
 * A first check of an address's shape on its chain, so a typo is caught before any quote. NEAR Intents checks it
 * properly when it quotes; this only says "that can't be right".
 */
export function addressLooksRight(chainMark: string, value: string): boolean {
  const v = value.trim()
  switch (chainMark) {
    case "eth":
    case "base":
    case "arb":
    case "bnb":
    case "pol":
    case "gnosis":
    case "avax":
      return EVM.test(v)
    case "sui":
      return /^0x[0-9a-fA-F]{64}$/.test(v)
    case "sol":
      return v.length >= 32 && v.length <= 44 && BASE58.test(v)
    case "tron":
      return v.length === 34 && v.startsWith("T") && BASE58.test(v)
    case "btc":
      return /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(v)
    default:
      return v.length >= 10
  }
}

/** A transaction on its own chain's explorer. */
export function chainTxUrl(chainMark: string, hash: string): string | null {
  const base: Record<string, string> = {
    eth: "https://etherscan.io/tx/",
    base: "https://basescan.org/tx/",
    arb: "https://arbiscan.io/tx/",
    bnb: "https://bscscan.com/tx/",
    pol: "https://polygonscan.com/tx/",
    gnosis: "https://gnosisscan.io/tx/",
    avax: "https://snowtrace.io/tx/",
    sui: "https://suiscan.xyz/mainnet/tx/",
    sol: "https://solscan.io/tx/",
    btc: "https://mempool.space/tx/",
    tron: "https://tronscan.org/#/transaction/",
  }
  return base[chainMark] ? `${base[chainMark]}${hash}` : null
}

/** "about 40 s" / "about 3 min", from 1Click's estimate in seconds. */
export function eta(seconds: number) {
  if (seconds < 90) return `about ${Math.max(10, Math.round(seconds / 10) * 10)} s`
  return `about ${Math.round(seconds / 60)} min`
}

/** The route a 1Click asset id names ("nep141:tron-…" → USDT on Tron), for marks on payments that came through it. */
export const routeOfAsset = (assetId: string | null | undefined) =>
  assetId ? PAYER_ROUTES.find((r) => r.assetId === assetId) : undefined
