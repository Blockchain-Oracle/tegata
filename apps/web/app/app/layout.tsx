"use client"

import { usePrivy } from "@privy-io/react-auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { TegataSeal } from "@/components/brand/seal"
import { LoadingShape, Skeleton } from "@/components/kit/states"
import { AppShell } from "@/components/shell/app-shell"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { signOutNearWallet } from "@/lib/client/near-account"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { logout } = usePrivy()
  const { ready, authenticated, profile, viaWallet } = useProfile()

  const needsWelcome =
    profile !== undefined &&
    (!profile.user.handle || profile.accounts.some((account) => !account.readyAt))

  useEffect(() => {
    if (ready && !authenticated) router.replace("/signin")
    else if (needsWelcome) router.replace("/welcome")
  }, [ready, authenticated, needsWelcome, router])

  const network = useNetwork()
  const account = profile?.accounts.find((entry) => entry.network === network)
  if (!profile || needsWelcome || !account) return <ShellSkeleton />

  return (
    <AppShell
      businessName={profile.workspace?.name ?? "Your business"}
      handle={account.accountId}
      accountId={account.accountId}
      live={network === "mainnet"}
      liveAvailable={profile.networks.includes("mainnet")}
      onSignOut={() =>
        (viaWallet ? signOutNearWallet(profile.user.walletNetwork ?? "testnet") : logout()).then(
          () => router.replace("/signin"),
        )
      }
    >
      {children}
    </AppShell>
  )
}

/** The shell's shape while the profile loads: rail, hero and rows, never a blank page or a made-up $0. */
function ShellSkeleton() {
  return (
    <div
      className="min-h-dvh bg-background lg:flex lg:gap-4 lg:p-4"
      role="status"
      aria-label="Loading Tegata"
    >
      <aside className="hidden h-[calc(100dvh-32px)] w-[248px] shrink-0 flex-col gap-4 rounded-[24px] bg-card p-4 lg:flex">
        <TegataSeal size={34} />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-11 w-full" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </aside>
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-4 pt-6 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[260px] w-full rounded-[24px]" />
        <LoadingShape shape="list" />
      </div>
    </div>
  )
}
