// What a scanned QR code means to Tegata, and where it goes. A Tegata link (pay page, invoice, receipt, a person's
// page, a join link) opens; a NEAR account opens Send with it filled in; a wallet's payment link or address on another
// chain (EIP-681, BIP-21, Solana Pay, a plain address) opens Send to another chain with the route and address filled.
import { addressLooksRight, PAYER_ROUTES } from "@/lib/routes"

export type Scanned =
  | { kind: "tegata"; href: string; what: string }
  | { kind: "near"; accountId: string; amount: string | null }
  | {
      kind: "chain"
      routeId: string
      address: string
      amount: string | null
      chain: string
      symbol: string
    }
  | { kind: "url"; url: string }
  | { kind: "text"; text: string }

const TEGATA_PATHS: [RegExp, string][] = [
  [/^\/pay\/[\w-]+/, "A pay link"],
  [/^\/i\/[\w-]+/, "An invoice"],
  [/^\/r\/[\w/-]+/, "A receipt"],
  [/^\/p\/[\w-]+/, "A payroll page"],
  [/^\/join\/[\w-]+/, "A join link"],
]
const TEGATA_HOSTS = /(^|\.)tegata\.xyz$|\.sslip\.io$|^localhost(:\d+)?$/

/** EVM chain ids → our route for the chain's USDC. */
const EVM_ROUTE: Record<number, string> = {
  1: "usdt-eth",
  8453: "usdc-base",
  42161: "usdc-arb",
  56: "usdt-bsc",
  137: "usdc-pol",
  100: "usdc-gnosis",
  43114: "usdc-avax",
}
const NEAR_ACCOUNT =
  /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.(near|testnet)$/
const IMPLICIT = /^[0-9a-f]{64}$/

function chain(routeId: string, address: string, amount: string | null): Scanned {
  const route = PAYER_ROUTES.find((r) => r.id === routeId) ?? PAYER_ROUTES[0]
  return {
    kind: "chain",
    routeId: route.id,
    address,
    amount,
    chain: route.chain,
    symbol: route.symbol,
  }
}

/** Read a QR code's text. */
export function readScanned(raw: string): Scanned {
  const text = raw.trim()
  // A Tegata link, on this site or the live one.
  try {
    const url = new URL(text)
    if (url.protocol === "https:" || url.protocol === "http:") {
      const host = url.host
      const ours =
        TEGATA_HOSTS.test(host) || (typeof window !== "undefined" && host === window.location.host)
      const match = ours ? TEGATA_PATHS.find(([re]) => re.test(url.pathname)) : undefined
      if (match) return { kind: "tegata", href: `${url.pathname}${url.search}`, what: match[1] }
      return { kind: "url", url: url.toString() }
    }
  } catch {
    // Not a web link: read on.
  }
  // EIP-681: ethereum:<to>[@chain][?value=] or ethereum:<token>@<chain>/transfer?address=<to>&uint256=<amount>
  const eip = text.match(
    /^ethereum:(?:pay-)?(0x[0-9a-fA-F]{40})(?:@(\d+))?(\/transfer)?(?:\?(.*))?$/,
  )
  if (eip) {
    const params = new URLSearchParams(eip[4] ?? "")
    const chainId = Number(eip[2] ?? 1)
    const to = eip[3] ? (params.get("address") ?? "") : (eip[1] ?? "")
    const routeId = eip[3]
      ? (EVM_ROUTE[chainId] ?? "usdc-base")
      : chainId === 1
        ? "eth-eth"
        : (EVM_ROUTE[chainId] ?? "eth-eth")
    return chain(routeId, to, null)
  }
  // BIP-21: bitcoin:<address>?amount=0.001
  const btc = text.match(/^bitcoin:([a-zA-Z0-9]+)(?:\?(.*))?$/i)
  // The amount in a BTC link is in bitcoin, not dollars: Send asks for dollars, so it isn't carried over.
  if (btc) return chain("btc-btc", btc[1] ?? "", null)
  // Solana Pay: solana:<recipient>?amount=…&spl-token=<mint>
  const sol = text.match(/^solana:([1-9A-HJ-NP-Za-km-z]{32,44})(?:\?(.*))?$/)
  if (sol) {
    const params = new URLSearchParams(sol[2] ?? "")
    // Only a stablecoin's amount is dollars; a SOL amount isn't carried over.
    const stable = Boolean(params.get("spl-token"))
    return chain(
      stable ? "usdc-sol" : "sol-sol",
      sol[1] ?? "",
      stable ? params.get("amount") : null,
    )
  }
  // NEAR: an account name or an implicit account, optionally as near:<account>.
  const near = text.replace(/^near:/i, "").toLowerCase()
  if (NEAR_ACCOUNT.test(near) || IMPLICIT.test(near))
    return { kind: "near", accountId: near, amount: null }
  // A bare address on another chain.
  if (addressLooksRight("tron", text)) return chain("usdt-tron", text, null)
  if (addressLooksRight("eth", text)) return chain("usdc-base", text, null)
  if (addressLooksRight("btc", text)) return chain("btc-btc", text, null)
  if (addressLooksRight("sol", text)) return chain("usdc-sol", text, null)
  return { kind: "text", text }
}

/** Where Tegata goes for a scanned code (null: nothing to open, just show it). */
export function scannedHref(scanned: Scanned): string | null {
  switch (scanned.kind) {
    case "tegata":
      return scanned.href
    case "near":
      return `/app/send?to=${encodeURIComponent(scanned.accountId)}`
    case "chain": {
      const q = new URLSearchParams({ mode: "chain", route: scanned.routeId, to: scanned.address })
      if (scanned.amount) q.set("amount", scanned.amount)
      return `/app/send?${q}`
    }
    default:
      return null
  }
}
