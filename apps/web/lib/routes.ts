// The coins and chains Tegata offers through NEAR Intents, shared by the server (quotes, pay-ins, payouts) and the
// screens (route grids, address checks, explorer links). Mark ids match public/marks.

/** The routes a payer is most likely to hold, and a payee most likely to want, in the order the screens show them. */
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

/** Dollar coins: a quote between them can use a tight slippage. */
export const isStable = (symbol: string) => symbol === "USDC" || symbol === "USDT"

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
      return EVM.test(v)
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
