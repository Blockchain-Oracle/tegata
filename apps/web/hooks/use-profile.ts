"use client"

import { usePrivy } from "@privy-io/react-auth"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { ApiError, api } from "@/lib/client/api"
import { forgetWalletSession, hasWalletSession } from "@/lib/client/near-account"
import type { Profile } from "@/lib/client/types"

import { useNearKey } from "./use-near-key"

const SETUP_POLL_MS = 2_000
const BALANCE_POLL_MS = 10_000
const UNAUTHORIZED = 401

/** Whether this browser signed in with a NEAR wallet (read after mount: the server render can't see cookies here). */
export function useWalletSession() {
  const [state, setState] = useState<{ checked: boolean; active: boolean }>({
    checked: false,
    active: false,
  })
  useEffect(() => setState({ checked: true, active: hasWalletSession() }), [])
  return {
    ...state,
    end: () => {
      forgetWalletSession()
      setState({ checked: true, active: false })
    },
  }
}

/**
 * The signed-in person, their business and their accounts. Email sign-in first tells the server who signed in (Privy);
 * a NEAR-wallet session already has. After that it polls quickly while an account is being set up, slowly otherwise.
 */
export function useProfile() {
  const privy = usePrivy()
  const key = useNearKey()
  const wallet = useWalletSession()
  const viaPrivy = !wallet.active && privy.ready && privy.authenticated && Boolean(key.address)

  const session = useQuery({
    queryKey: ["session", key.address],
    queryFn: () => api<Profile>("/api/session", { method: "POST" }),
    enabled: viaPrivy,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Profile>("/api/me"),
    enabled: wallet.active || (viaPrivy && session.isSuccess),
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === UNAUTHORIZED) && count < 2,
    refetchInterval: (query) => {
      const accounts = query.state.data?.accounts ?? []
      if (accounts.length === 0) return false
      return accounts.some((account) => !account.readyAt) ? SETUP_POLL_MS : BALANCE_POLL_MS
    },
  })

  // A wallet session that has expired or was ended elsewhere: forget it, so the app sends them to sign in.
  const walletExpired =
    wallet.active && profile.error instanceof ApiError && profile.error.status === UNAUTHORIZED
  const { end } = wallet
  useEffect(() => {
    if (walletExpired) end()
  }, [walletExpired, end])

  const authenticated = wallet.active || privy.authenticated
  return {
    /** We know whether someone is signed in, and if by email, their key exists. */
    ready:
      wallet.checked && (wallet.active || (privy.ready && (!privy.authenticated || key.ready))),
    authenticated,
    /** Signed in with a NEAR wallet rather than an email. */
    viaWallet: wallet.active,
    loading:
      (wallet.active || viaPrivy) &&
      (wallet.active ? profile.isPending : session.isPending || profile.isPending),
    error: session.error ?? profile.error,
    profile: profile.data ?? session.data,
    refetch: profile.refetch,
  }
}
