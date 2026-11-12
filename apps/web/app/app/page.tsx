"use client"

import { useQuery } from "@tanstack/react-query"
import { NETWORKS } from "@tegata/config"

import { HomeView } from "@/components/home/home-view"
import { useShell } from "@/components/shell/shell-context"
import { useProfile } from "@/hooks/use-profile"
import { useTestDollars } from "@/hooks/use-test-dollars"
import { api } from "@/lib/client/api"
import type { ActivityItem } from "@/lib/client/types"

const ACTIVITY_POLL_MS = 10_000

export default function HomePage() {
  const { profile } = useProfile()
  const { openReceive } = useShell()
  const testDollars = useTestDollars()
  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: () => api<{ items: ActivityItem[] }>("/api/activity"),
    refetchInterval: ACTIVITY_POLL_MS,
  })
  const account = profile?.accounts.find((entry) => entry.network === "testnet")
  if (!profile || !account) return null

  return (
    <HomeView
      businessName={profile.workspace?.name ?? "Your business"}
      accountId={account.accountId}
      balance={account.balance === undefined ? null : BigInt(account.balance)}
      explorerUrl={`${NETWORKS[account.network].explorer}/address/${account.accountId}`}
      activity={activity.data?.items}
      activityError={activity.isError}
      onReceive={openReceive}
      onRetryActivity={() => void activity.refetch()}
      testDollars={account.network === "testnet" ? testDollars : undefined}
      onAddTestDollars={testDollars.add}
    />
  )
}
