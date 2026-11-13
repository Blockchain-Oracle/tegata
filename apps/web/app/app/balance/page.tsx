"use client"

import { useQuery } from "@tanstack/react-query"

import { BalanceView } from "@/components/books/balance-view"
import { useShell } from "@/components/shell/shell-context"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { useTestDollars } from "@/hooks/use-test-dollars"
import { ApiError, api } from "@/lib/client/api"
import type { AutopilotView, Reconciliation } from "@/lib/client/types"

export default function BalancePage() {
  const { profile } = useProfile()
  const { openReceive } = useShell()
  const testDollars = useTestDollars()
  const network = useNetwork()
  const account = profile?.accounts.find((entry) => entry.network === network)
  const autopilot = useQuery({
    queryKey: ["autopilot"],
    queryFn: () => api<{ autopilot: AutopilotView }>("/api/autopilot"),
    select: (data) => data.autopilot,
  })
  const reconcile = useQuery({
    queryKey: ["reconcile"],
    queryFn: () => api<Reconciliation>("/api/books/reconcile"),
    retry: 1,
    staleTime: 60_000,
  })
  const funds = autopilot.data?.funds
  const setAside = funds ? (BigInt(funds.available) + BigInt(funds.reserved)).toString() : "0"
  return (
    <BalanceView
      balance={account?.balance ?? null}
      setAside={setAside}
      accountId={account?.accountId ?? ""}
      reconciliation={reconcile.data}
      reconcileError={
        reconcile.error
          ? reconcile.error instanceof ApiError
            ? reconcile.error.message
            : "NearBlocks didn't answer. Try again in a minute."
          : null
      }
      onReconcile={() => void reconcile.refetch()}
      onReceive={openReceive}
      onTestDollars={account?.network === "testnet" ? testDollars.add : undefined}
      live={network === "mainnet"}
    />
  )
}
