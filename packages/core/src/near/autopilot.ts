// The autopilot contract from the app's side (6.8 T): the calls a business signs (gas-free, relayed),
// the operator's calls, the views, and its NEP-297 events read back from a transaction.
import { AUTOPILOT, GAS, NETWORKS, type NetworkId, ONE_YOCTO } from "@tegata/config"

import { type CallSpec, call } from "./calls.ts"
import { nearProvider, view } from "./provider.ts"

export interface AutopilotRow {
  account_id: string
  /** USDC base units, as a string. */
  amount: string
}

export interface AutopilotPlanView {
  plan_id: string
  owner: string
  status: "Active" | "Paused" | "Finished"
  due: string[]
  next: number
  cursor: number
  rows: number
  total: string
  storage_cost: string
  last_occurrence: number | null
  last_paid: number
  last_failed: number
}

export interface AutopilotBusinessView {
  available: string
  reserved: string
  in_flight: string
  storage_balance: string
  storage_payer: string
  plans: string[]
}

const autopilotOf = (network: NetworkId) => NETWORKS[network].autopilot

/** On the USDC contract: set money aside in the autopilot (`msg` must be empty, or it is refused). */
export function autopilotDeposit(network: NetworkId, amount: bigint): CallSpec {
  return call(
    "ft_transfer_call",
    { receiver_id: autopilotOf(network), amount: amount.toString(), msg: "" },
    GAS.ftTransferCall,
    ONE_YOCTO,
  )
}

/** On the autopilot: a plan of rows paid on each due timestamp (milliseconds). */
export function autopilotCreatePlan(rows: AutopilotRow[], dueMs: number[]): CallSpec {
  return call("create_plan", { rows, due: dueMs.map((ms) => ms.toString()) }, GAS.autopilotPlan)
}

export type AutopilotAction = "pause_plan" | "resume_plan" | "cancel_plan"

export function autopilotPlanAction(action: AutopilotAction, planId: string): CallSpec {
  return call(action, { plan_id: planId }, GAS.autopilotAction)
}

export function autopilotWithdraw(amount: bigint): CallSpec {
  return call("withdraw", { amount: amount.toString() }, GAS.autopilotAction, ONE_YOCTO)
}

/** Operator: register a business (it pays the storage, and gets it back when plans are cancelled). */
export function autopilotRegister(accountId: string): CallSpec {
  return call(
    "storage_deposit",
    { account_id: accountId },
    GAS.autopilotAction,
    AUTOPILOT.storageYocto,
  )
}

/** Anyone (the keeper): pay the next chunk of a due plan. */
export function autopilotRun(planId: string): CallSpec {
  return call("run", { plan_id: planId }, GAS.autopilotRun)
}

export function autopilotBusiness(network: NetworkId, accountId: string) {
  return view<AutopilotBusinessView | null>(network, autopilotOf(network), "get_business", {
    account_id: accountId,
  })
}

export function autopilotPlan(network: NetworkId, planId: string) {
  return view<AutopilotPlanView | null>(network, autopilotOf(network), "get_plan", {
    plan_id: planId,
  })
}

export interface AutopilotEvent {
  event: string
  data: Record<string, unknown>
}

const EVENT_PREFIX = "EVENT_JSON:"

/** The autopilot's own events in a final transaction, in order; empty while it isn't final yet. */
export async function readAutopilotEvents(
  network: NetworkId,
  txHash: string,
  senderId: string,
): Promise<AutopilotEvent[] | null> {
  let outcome: { receipts_outcome?: { outcome?: { executor_id?: string; logs?: string[] } }[] }
  try {
    outcome = (await nearProvider(network).viewTransactionStatus({
      txHash,
      accountId: senderId,
      waitUntil: "FINAL",
    })) as typeof outcome
  } catch {
    return null
  }
  const events: AutopilotEvent[] = []
  for (const receipt of outcome.receipts_outcome ?? []) {
    if (receipt.outcome?.executor_id !== autopilotOf(network)) continue
    for (const line of receipt.outcome.logs ?? []) {
      if (!line.startsWith(EVENT_PREFIX)) continue
      try {
        const parsed = JSON.parse(line.slice(EVENT_PREFIX.length)) as {
          standard?: string
          event?: string
          data?: Record<string, unknown>
        }
        if (parsed.standard === AUTOPILOT.standard && parsed.event)
          events.push({ event: parsed.event, data: parsed.data ?? {} })
      } catch {
        // Not JSON: not one of ours.
      }
    }
  }
  return events
}
