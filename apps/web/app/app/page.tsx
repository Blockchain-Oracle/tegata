"use client"

import { useQuery } from "@tanstack/react-query"
import type { PotsView } from "@/components/books/pots-card"
import { HomeView } from "@/components/home/home-view"
import { AppInvite } from "@/components/shell/app-invite"
import { useShell } from "@/components/shell/shell-context"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { useTestDollars } from "@/hooks/use-test-dollars"
import { api } from "@/lib/client/api"
import type { ActivityItem, ReferralsView } from "@/lib/client/types"

const ACTIVITY_POLL_MS = 10_000

export default function HomePage() {
  const { profile } = useProfile()
  const { openReceive, openScan } = useShell()
  const testDollars = useTestDollars()
  const network = useNetwork()
  const activity = useQuery({
    queryKey: ["activity", network],
    queryFn: () => api<{ items: ActivityItem[] }>("/api/activity"),
    refetchInterval: ACTIVITY_POLL_MS,
  })
  const referrals = useQuery({
    queryKey: ["referrals"],
    queryFn: () => api<ReferralsView>("/api/referrals"),
    staleTime: 60_000,
  })
  const steps = useQuery({
    queryKey: ["steps"],
    queryFn: () =>
      api<{ invoiceSent: boolean; linkMade: boolean; peopleAdded: boolean }>("/api/steps"),
    staleTime: 60_000,
  })
  const due = useQuery({
    queryKey: ["payroll", "due"],
    queryFn: () =>
      api<{ due: { payday: string; people: number; total: string } | null }>("/api/payroll/due"),
    staleTime: 60_000,
  }).data?.due
  const by = referrals.data?.referredBy
  // The same pots the Balance page shows (one cache entry per network).
  const pots = useQuery({
    queryKey: ["pots", network],
    queryFn: () => api<PotsView>("/api/pots"),
    staleTime: 30_000,
  }).data
  const account = profile?.accounts.find((entry) => entry.network === network)
  if (!profile || !account) return null

  return (
    <>
      <AppInvite />
      <HomeView
        businessName={profile.workspace?.name ?? "Your business"}
        accountId={account.accountId}
        network={account.network}
        balance={account.balance === undefined ? null : BigInt(account.balance)}
        activity={activity.data?.items}
        activityError={activity.isError}
        onReceive={openReceive}
        onScan={openScan}
        onRetryActivity={() => void activity.refetch()}
        testDollars={account.network === "testnet" ? testDollars : undefined}
        onAddTestDollars={testDollars.add}
        steps={steps.data}
        payrollDue={due ? { ...due, total: BigInt(due.total) } : null}
        pots={
          pots
            ? {
                spendable: BigInt(pots.spendable),
                tax: BigInt(pots.tax),
                savings: BigInt(pots.savings),
              }
            : null
        }
        invite={
          by && referrals.data && (by.status === "open" || by.status === "qualified")
            ? {
                business: by.business,
                received: BigInt(by.received),
                threshold: BigInt(referrals.data.rules.threshold),
                reward: BigInt(referrals.data.rules.reward),
                qualified: by.status === "qualified",
              }
            : null
        }
      />
    </>
  )
}
