"use client"

import { PrivyProvider } from "@privy-io/react-auth"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

const STALE_MS = 30_000

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: STALE_MS, retry: 1 } } }),
  )

  if (!PRIVY_APP_ID) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
        <h1 className="figure text-4xl">Sign-in is not set up</h1>
        <p className="text-muted-foreground">
          Add <code>NEXT_PUBLIC_PRIVY_APP_ID</code>, <code>PRIVY_APP_ID</code> and{" "}
          <code>PRIVY_APP_SECRET</code> to <code>.env</code> at the repo root, then restart.
        </p>
      </main>
    )
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        // Tegata shows its own review screen; Privy never opens a wallet prompt.
        embeddedWallets: { showWalletUIs: false },
        appearance: { theme: "light", accentColor: "#16130F" },
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PrivyProvider>
  )
}
