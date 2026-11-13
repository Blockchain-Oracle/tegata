// A NEAR account or transaction, as a link to the explorer (discoverability: every account name leads somewhere).
// Mono, a dotted underline that turns solid on hover and focus, and a small ↗, so it reads as a link on a phone too.
import { NETWORKS, type NetworkId } from "@tegata/config"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

/** A NEAR account's network from its name; implicit accounts fall back to the Sandbox. */
export function networkOf(accountId: string, fallback: NetworkId = "testnet"): NetworkId {
  if (accountId.endsWith(".testnet")) return "testnet"
  if (accountId.endsWith(".near")) return "mainnet"
  return fallback
}

export const accountUrl = (accountId: string, network?: NetworkId) =>
  `${NETWORKS[network ?? networkOf(accountId)].explorer}/address/${accountId}`
export const txUrl = (hash: string, network: NetworkId) =>
  `${NETWORKS[network].explorer}/txns/${hash}`

const LINK =
  "inline-flex min-w-0 items-center gap-0.5 underline decoration-current/35 decoration-dotted underline-offset-[3px] transition-colors hover:decoration-solid focus-visible:decoration-solid focus-visible:outline-none"

export function AccountLink({
  accountId,
  network,
  className,
}: {
  accountId: string
  network?: NetworkId
  className?: string
}) {
  return (
    <a
      href={accountUrl(accountId, network)}
      target="_blank"
      rel="noreferrer"
      title={`${accountId} on the NEAR explorer`}
      className={cn(LINK, "font-mono", className)}
    >
      <span className="truncate">{accountId}</span>
      <ArrowUpRight className="size-3 shrink-0 opacity-60" aria-hidden />
    </a>
  )
}

export function TxLink({
  hash,
  network,
  className,
}: {
  hash: string
  network: NetworkId
  className?: string
}) {
  return (
    <a
      href={txUrl(hash, network)}
      target="_blank"
      rel="noreferrer"
      title="This transaction on the NEAR explorer"
      className={cn(LINK, "font-mono", className)}
    >
      {hash.slice(0, 6)}…{hash.slice(-6)}
      <ArrowUpRight className="size-3 shrink-0 opacity-60" aria-hidden />
    </a>
  )
}
