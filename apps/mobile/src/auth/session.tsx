// The signed-in person on the phone. Privy's Expo SDK does the email code and holds the NEAR key (an extended-chain
// wallet, the same one the web creates with `useCreateWallet({ chainType: "near" })`); the key never reaches our code,
// which only asks Privy to sign a 32-byte hash. After sign-in the server is told who signed in (`POST /api/session`,
// which reads the email and key from Privy itself), then the profile is polled: fast while the account opens, slower
// after. The mode (Sandbox | Live) is part of every request.
import { PrivyProvider, useLoginWithEmail, usePrivy } from "@privy-io/expo"
import { useCreateWallet, useSignRawHash } from "@privy-io/expo/extended-chains"
import { base64 } from "@scure/base"
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query"
import * as SecureStore from "expo-secure-store"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { ApiError, api, type Mode, setApiSession } from "@/api/client"
import type { AccountView, NetworkId, Profile } from "@/api/types"
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from "@/config"

const SETUP_POLL_MS = 2_000
const BALANCE_POLL_MS = 10_000
const MODE_KEY = "tegata.mode"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) =>
        !(error instanceof ApiError && error.status < 500 && error.status > 0) && count < 2,
      staleTime: 5_000,
    },
  },
})

interface SessionValue {
  ready: boolean
  authenticated: boolean
  email: string | null
  /** The Privy-held NEAR key's address (32-byte public key in hex), once it exists. */
  keyAddress: string | null
  profile: Profile | undefined
  profileLoading: boolean
  profileError: unknown
  refetchProfile: () => void
  mode: Mode
  setMode: (mode: Mode) => void
  /** The network this mode means, given what the server has switched on. */
  network: NetworkId
  account: AccountView | undefined
  sendCode: (email: string) => Promise<void>
  loginWithCode: (email: string, code: string) => Promise<void>
  /** Sign a hex hash with the person's NEAR key; base64 signature. */
  sign: (hashHex: string) => Promise<string>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error("useSession outside SessionProvider")
  return value
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}

type LinkedAccount = { type: string; address?: string; chain_type?: string }

function SessionProvider({ children }: { children: ReactNode }) {
  const privy = usePrivy()
  const { sendCode, loginWithCode } = useLoginWithEmail()
  const { createWallet } = useCreateWallet()
  const { signRawHash } = useSignRawHash()
  const client = useQueryClient()
  const [mode, setModeState] = useState<Mode>("sandbox")
  const [modeLoaded, setModeLoaded] = useState(false)
  const creating = useRef(false)

  const linked = (privy.user?.linked_accounts ?? []) as LinkedAccount[]
  const email = linked.find((account) => account.type === "email")?.address ?? null
  const keyAddress =
    linked.find((account) => account.type === "wallet" && account.chain_type === "near")?.address ??
    null
  const authenticated = Boolean(privy.user)

  // Every request carries the token Privy has now (refreshed when near expiry) and the chosen mode.
  useEffect(() => {
    setApiSession({ token: () => privy.getAccessToken().catch(() => null), mode })
  }, [privy.getAccessToken, mode])

  useEffect(() => {
    SecureStore.getItemAsync(MODE_KEY)
      .then((saved) => {
        if (saved === "live" || saved === "sandbox") {
          setModeState(saved)
          setApiSession({ mode: saved })
        }
      })
      .catch(() => undefined)
      .finally(() => setModeLoaded(true))
  }, [])

  // The NEAR key is made once, the first time someone signs in (the web does the same).
  useEffect(() => {
    if (!privy.isReady || !authenticated || keyAddress || creating.current) return
    creating.current = true
    createWallet({ chainType: "near" })
      .catch(() => undefined)
      .finally(() => {
        creating.current = false
      })
  }, [privy.isReady, authenticated, keyAddress, createWallet])

  const session = useQuery({
    queryKey: ["session", keyAddress],
    queryFn: () => api<Profile>("/api/session", { method: "POST" }),
    enabled: authenticated && Boolean(keyAddress) && modeLoaded,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const profile = useQuery({
    queryKey: ["me", mode],
    queryFn: () => api<Profile>("/api/me"),
    enabled: authenticated && session.isSuccess,
    refetchInterval: (query) => {
      const accounts = query.state.data?.accounts ?? []
      if (accounts.length === 0) return false
      return accounts.some((account) => !account.readyAt) ? SETUP_POLL_MS : BALANCE_POLL_MS
    },
  })

  const data = profile.data ?? session.data
  const network: NetworkId =
    mode === "live" && data?.networks.includes("mainnet") ? "mainnet" : "testnet"
  const account = data?.accounts.find((entry) => entry.network === network)

  const setMode = useCallback(
    (next: Mode) => {
      setModeState(next)
      setApiSession({ mode: next })
      void SecureStore.setItemAsync(MODE_KEY, next).catch(() => undefined)
      // Every screen reads the other network from the start, as the web does with a reload.
      void client.invalidateQueries()
    },
    [client],
  )

  const sign = useCallback(
    async (hashHex: string) => {
      if (!keyAddress) throw new Error("Your signing key is not ready yet")
      const { signature } = await signRawHash({
        address: keyAddress,
        chainType: "near",
        hash: `0x${hashHex}`,
      })
      const hex = signature.replace(/^0x/, "")
      const bytes = Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
      return base64.encode(bytes)
    },
    [keyAddress, signRawHash],
  )

  const value = useMemo<SessionValue>(
    () => ({
      ready: privy.isReady && modeLoaded && (!authenticated || Boolean(keyAddress)),
      authenticated,
      email,
      keyAddress,
      profile: data,
      profileLoading: authenticated && (session.isPending || profile.isPending),
      profileError: session.error ?? profile.error,
      refetchProfile: () => void profile.refetch(),
      mode,
      setMode,
      network,
      account,
      sendCode: async (address) => {
        await sendCode({ email: address })
      },
      loginWithCode: async (address, code) => {
        await loginWithCode({ code, email: address })
      },
      sign,
      signOut: async () => {
        await privy.logout()
        client.clear()
      },
    }),
    [
      privy,
      modeLoaded,
      authenticated,
      keyAddress,
      email,
      data,
      session.isPending,
      session.error,
      profile,
      mode,
      setMode,
      network,
      account,
      sendCode,
      loginWithCode,
      sign,
      client,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
