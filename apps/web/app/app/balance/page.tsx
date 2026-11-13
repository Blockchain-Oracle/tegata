"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { AddMoneySheet } from "@/components/books/add-money-sheet"
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
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  // Home's "Add money" lands here with ?add=1: open the chooser, then drop the flag so a refresh doesn't reopen it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add")) {
      setAdding(true)
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])
  const cardTopUp = useMutation({
    mutationFn: (amount: string) =>
      api<{ url: string }>("/api/balance/topup", { body: { amount, via: "card" } }),
    onSuccess: ({ url }) => router.push(url),
  })
  const cards = useQuery({
    queryKey: ["cards-open", network],
    queryFn: () => api<{ open: boolean; reason?: string }>("/api/balance/topup?via=card"),
    staleTime: 60_000,
  })
  const topUp = useMutation({
    mutationFn: (amount: string) =>
      api<{ url: string }>("/api/balance/topup", { body: { amount } }),
    onSuccess: ({ url }) => router.push(url),
  })
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
  const sandbox = account?.network === "testnet"
  return (
    <>
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
        onAddMoney={() => setAdding(true)}
        live={network === "mainnet"}
      />
      <AddMoneySheet
        open={adding}
        onOpenChange={setAdding}
        live={network === "mainnet"}
        accountId={account?.accountId ?? ""}
        onPayAddress={openReceive}
        testDollars={sandbox ? testDollars : undefined}
        onTestDollars={sandbox ? testDollars.add : undefined}
        card={{
          open: cards.data?.open ?? false,
          reason: cards.data?.reason,
          busy: cardTopUp.isPending,
          problem:
            cardTopUp.error instanceof ApiError
              ? cardTopUp.error.message
              : cardTopUp.error
                ? "Couldn't start it. Try again."
                : null,
          onContinue: (amount) => cardTopUp.mutate(amount),
        }}
        chain={{
          busy: topUp.isPending,
          problem:
            topUp.error instanceof ApiError
              ? topUp.error.message
              : topUp.error
                ? "Couldn't start it. Try again."
                : null,
          onContinue: (amount) => topUp.mutate(amount),
        }}
      />
    </>
  )
}
