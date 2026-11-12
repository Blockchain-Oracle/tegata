// The autopilot as the Payroll page sees it: our row, plus the contract's own numbers read from NEAR.
import { NETWORKS } from "@tegata/config"
import { autopilotState } from "@tegata/services"

import type { AutopilotView } from "@/lib/client/types"

import { db } from "./context.ts"
import { PAYROLL_NETWORK } from "./payroll.ts"

export async function autopilotView(workspaceId: string, timezone: string): Promise<AutopilotView> {
  const { row, business, plan, lastId } = await autopilotState(db(), workspaceId, PAYROLL_NETWORK)
  const net = NETWORKS[PAYROLL_NETWORK]
  return {
    contract: net.autopilot,
    contractUrl: `${net.explorer}/address/${net.autopilot}`,
    lastId,
    timezone,
    row: row && {
      id: row.id,
      status: row.status,
      planId: row.planId,
      paydays: row.paydays,
      dueMs: row.dueMs,
      rows: row.rows,
      total: row.total.toString(),
      setAside: row.setAside.toString(),
      underfunded: row.underfunded ?? null,
      error: row.error,
    },
    funds: business && {
      available: business.available,
      reserved: business.reserved,
      inFlight: business.in_flight,
    },
    plan: plan && {
      status: plan.status,
      next: plan.next,
      cursor: plan.cursor,
      due: plan.due.map(Number),
      lastPaid: plan.last_paid,
      lastFailed: plan.last_failed,
    },
  }
}
