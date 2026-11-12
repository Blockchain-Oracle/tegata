"use client"

import { usePrivy } from "@privy-io/react-auth"
import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/client/api"
import type { Profile } from "@/lib/client/types"

import { useNearKey } from "./use-near-key"

const SETUP_POLL_MS = 2_000
const BALANCE_POLL_MS = 10_000

/**
 * The signed-in person, their business and their accounts. The first load tells the server
 * who signed in; after that it polls quickly while an account is being set up, slowly otherwise.
 */
export function useProfile() {
  const { ready, authenticated } = usePrivy()
  const key = useNearKey()
  const enabled = ready && authenticated && Boolean(key.address)

  const session = useQuery({
    queryKey: ["session", key.address],
    queryFn: () => api<Profile>("/api/session", { method: "POST" }),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Profile>("/api/me"),
    enabled: enabled && session.isSuccess,
    refetchInterval: (query) => {
      const accounts = query.state.data?.accounts ?? []
      if (accounts.length === 0) return false
      return accounts.some((account) => !account.readyAt) ? SETUP_POLL_MS : BALANCE_POLL_MS
    },
  })

  return {
    /** Privy has finished loading and, if signed in, the key exists. */
    ready: ready && (!authenticated || key.ready),
    authenticated,
    loading: enabled && (session.isPending || profile.isPending),
    error: session.error ?? profile.error,
    profile: profile.data ?? session.data,
    refetch: profile.refetch,
  }
}
