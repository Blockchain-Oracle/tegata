import { NETWORKS, type NetworkId } from "@tegata/config"

import { nearProvider } from "./provider.ts"

/** One NEP-141 `ft_transfer` event emitted by the USDC contract. */
export interface UsdcTransfer {
  from: string
  to: string
  /** USDC base units. */
  amount: bigint
  memo: string | null
}

export type TransferRead =
  | { state: "final"; ok: true; transfers: UsdcTransfer[] }
  | { state: "final"; ok: false; error: string; transfers: UsdcTransfer[] }
  | { state: "pending" }

interface ReceiptOutcome {
  outcome?: { executor_id?: string; logs?: string[]; status?: unknown }
}

interface Nep141Event {
  standard?: string
  event?: string
  data?: { old_owner_id: string; new_owner_id: string; amount: string; memo?: string }[]
}

const EVENT_PREFIX = "EVENT_JSON:"

/**
 * Read a transaction from NEAR and list the USDC transfers it made, from the token contract's own NEP-297 events.
 * This is the proof a payment arrived (plan section 2, "Paying in"): an event from the USDC contract, not a claim
 * from the browser. A transaction NEAR doesn't know yet, or that isn't final, reads as pending.
 */
export async function readUsdcTransfers(
  network: NetworkId,
  txHash: string,
  senderId: string,
): Promise<TransferRead> {
  let outcome: { status?: unknown; receipts_outcome?: ReceiptOutcome[] }
  try {
    outcome = (await nearProvider(network).viewTransactionStatus({
      txHash,
      accountId: senderId,
      waitUntil: "FINAL",
    })) as typeof outcome
  } catch {
    return { state: "pending" }
  }

  const usdc = NETWORKS[network].usdc
  const transfers: UsdcTransfer[] = []
  let error: string | undefined
  for (const receipt of outcome.receipts_outcome ?? []) {
    const failure = failureOf(receipt.outcome?.status)
    if (failure && !error) error = failure
    if (receipt.outcome?.executor_id !== usdc) continue
    for (const line of receipt.outcome.logs ?? []) {
      if (!line.startsWith(EVENT_PREFIX)) continue
      let event: Nep141Event
      try {
        event = JSON.parse(line.slice(EVENT_PREFIX.length)) as Nep141Event
      } catch {
        continue
      }
      if (event.standard !== "nep141" || event.event !== "ft_transfer") continue
      for (const item of event.data ?? []) {
        transfers.push({
          from: item.old_owner_id,
          to: item.new_owner_id,
          amount: BigInt(item.amount),
          memo: item.memo ?? null,
        })
      }
    }
  }
  const top = failureOf(outcome.status)
  if (top && !error) error = top
  return error
    ? { state: "final", ok: false, error, transfers }
    : { state: "final", ok: true, transfers }
}

/** The transfer that pays an attempt: to the business, at least the amount, carrying the attempt's memo. */
export function matchingTransfer(
  transfers: UsdcTransfer[],
  expected: { to: string; amount: bigint; memo: string },
): UsdcTransfer | undefined {
  return transfers.find(
    (t) => t.to === expected.to && t.memo === expected.memo && t.amount >= expected.amount,
  )
}

function failureOf(status: unknown): string | undefined {
  if (status && typeof status === "object" && "Failure" in status) {
    return JSON.stringify((status as { Failure: unknown }).Failure)
  }
  return undefined
}
