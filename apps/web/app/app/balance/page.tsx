"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { AddMoneySheet } from "@/components/books/add-money-sheet"
import { BalanceView } from "@/components/books/balance-view"
import { type PotKind, PotsCard, type PotsView } from "@/components/books/pots-card"
import { useShell } from "@/components/shell/shell-context"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { useTestDollars } from "@/hooks/use-test-dollars"
import { ApiError, api } from "@/lib/client/api"
import type { AutopilotView, Reconciliation } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

export default function BalancePage() {
  const { profile } = useProfile()
  const { openReceive } = useShell()
  const testDollars = useTestDollars()
  const network = useNetwork()
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const queryClient = useQueryClient()
  const pots = useQuery({
    queryKey: ["pots", network],
    queryFn: () => api<PotsView>("/api/pots"),
    refetchInterval: 15_000,
  })
  const potAction = useMutation({
    mutationFn: (
      action:
        | { kind: "rule"; rule: PotsView["rule"] }
        | { kind: "move"; pot: PotKind; direction: "to_spending" | "to_pot"; amount: string },
    ) =>
      action.kind === "rule"
        ? api("/api/pots", { method: "PATCH", body: action.rule })
        : api("/api/pots/move", {
            body: { kind: action.pot, direction: action.direction, amount: action.amount },
          }),
    onSuccess: () => {
      fire("tick", { cue: "confirmed" })
      void queryClient.invalidateQueries({ queryKey: ["pots", network] })
    },
    onError: () => fire("fail", { cue: "error" }),
  })
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
        pots={
          <PotsCard
            view={pots.data}
            busy={potAction.isPending}
            problem={
              potAction.error
                ? potAction.error instanceof ApiError
                  ? potAction.error.message
                  : "That didn't save. Try again."
                : null
            }
            onRule={(rule) => potAction.mutate({ kind: "rule", rule })}
            onMove={({ kind, direction, amount }) =>
              potAction.mutate({ kind: "move", pot: kind, direction, amount })
            }
          />
        }
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
