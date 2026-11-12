"use client"

// The pay page's logic. Every rail ends the same way: the server reads the USDC transfer from NEAR and only then
// calls it paid (plan section 2, "Paying in"). Nothing the browser says is believed.
//  · Tegata balance: the server drafts the transfer with the attempt's memo; this page checks the draft is exactly
//    this link's receiver, amount and memo, the Privy key signs it, and our relayer sends it gas-free.
//  · NEAR wallet: the wallet sends one `ft_transfer` with the memo; this page hands the hash to the server.
//  · Another chain: a live NEAR Intents quote; deposit addresses run in Live only (no testnet).
import { usePrivy } from "@privy-io/react-auth"
import { useQuery } from "@tanstack/react-query"
import { GAS, ONE_YOCTO } from "@tegata/config"
import { toUnits } from "@tegata/core/money"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { viewDollars } from "@/components/kit/figure"
import { type PayRoute, type PayStep, PayView, type TegataState } from "@/components/pay/pay-view"
import { useNearKey } from "@/hooks/use-near-key"
import { useProfile } from "@/hooks/use-profile"
import { useTestDollars } from "@/hooks/use-test-dollars"
import { ApiError, api } from "@/lib/client/api"
import { rememberNext } from "@/lib/client/next-path"
import type {
  AttemptView,
  PaymentRail,
  PublicRequest,
  TegataAttempt,
  WalletAttempt,
} from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const POLL_MS = 1_200
const QUOTE_DEBOUNCE_MS = 400
const TERMINAL: AttemptView["status"][] = ["succeeded", "failed", "refunded", "expired"]
const CLAIM_TRIES = 4
const CLAIM_BACKOFF_MS = 1_500

function units(dollars: string): bigint | null {
  try {
    const value = toUnits(dollars.trim())
    return value > 0n ? value : null
  } catch {
    return null
  }
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** What a wallet error means for the payer, in their words. */
function walletProblem(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/reject|cancel|closed|denied/i.test(message))
    return "You closed the wallet. Nothing was sent."
  if (/not enough|NotEnoughBalance|exceeds|insufficient/i.test(message))
    return "That wallet doesn't hold enough USDC for this payment."
  if (/does not exist|AccountDoesNotExist/i.test(message))
    return "That account doesn't exist on this network. Check your wallet is on the right one."
  return message || "The wallet couldn't send it. Try again."
}

interface WalletClaim {
  paymentId: string
  txHash: string
  payer: string
}

const claimKey = (token: string) => `tegata.claim.${token}`

function saveClaim(token: string, claim: WalletClaim) {
  try {
    sessionStorage.setItem(claimKey(token), JSON.stringify(claim))
  } catch {
    // Storage blocked: the claim is still sent below.
  }
}

function loadClaim(token: string): WalletClaim | null {
  try {
    const raw = sessionStorage.getItem(claimKey(token))
    return raw ? (JSON.parse(raw) as WalletClaim) : null
  } catch {
    return null
  }
}

function clearClaim(token: string) {
  try {
    sessionStorage.removeItem(claimKey(token))
  } catch {
    // Nothing to clear.
  }
}

/** Hand the wallet's transaction to the server, retrying a dropped connection rather than lose a sent payment. */
async function submitClaim(claim: WalletClaim) {
  for (let i = 0; ; i++) {
    try {
      await api(`/api/pay/attempts/${claim.paymentId}/tx`, {
        body: { txHash: claim.txHash, payer: claim.payer },
      })
      return
    } catch (error) {
      if (i >= CLAIM_TRIES - 1 || (error instanceof ApiError && error.status < 500)) throw error
      await new Promise((resolve) => setTimeout(resolve, CLAIM_BACKOFF_MS * (i + 1)))
    }
  }
}

export function PayClient({
  initial,
  routes,
}: {
  initial: PublicRequest
  routes: readonly PayRoute[]
}) {
  const router = useRouter()
  const { ready, authenticated } = usePrivy()
  const { profile } = useProfile()
  const key = useNearKey()
  const testDollars = useTestDollars()
  const network = initial.network

  const [rail, setRail] = useState<PaymentRail | null>(network === "testnet" ? "tegata" : null)
  const [amount, setAmount] = useState("")
  const [step, setStep] = useState<PayStep>("choose")
  const [usedRail, setUsedRail] = useState<PaymentRail | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [walletAccount, setWalletAccount] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "")

  const request = useQuery({
    queryKey: ["pay", initial.token],
    queryFn: () => api<PublicRequest>(`/api/pay/${initial.token}`),
    initialData: initial,
    staleTime: 30_000,
  }).data

  const due = request.amount !== null ? BigInt(request.amount) : units(amount)

  // A wallet the payer already connected on this site, without asking.
  useEffect(() => {
    let live = true
    void import("@/lib/client/near-wallet").then(({ connectedNearAccount }) =>
      connectedNearAccount(network).then((account) => {
        if (live) setWalletAccount(account)
      }),
    )
    return () => {
      live = false
    }
  }, [network])

  const attempt = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => api<AttemptView>(`/api/pay/attempts/${attemptId}`),
    enabled: step === "paying" && Boolean(attemptId),
    refetchInterval: (query) =>
      query.state.data && TERMINAL.includes(query.state.data.status) ? false : POLL_MS,
  })

  const status = attempt.data?.status
  useEffect(() => {
    if (step !== "paying" || !status) return
    if (status === "succeeded") setStep("paid")
    else if (TERMINAL.includes(status)) {
      fire("fail", { cue: "error" })
      setProblem(attempt.data?.error ?? "NEAR didn't settle it.")
      setStep("failed")
    }
  }, [status, step, attempt.data?.error])

  const dollarsForQuote = useDebounced(due ? viewDollars(due).toFixed(2) : "", QUOTE_DEBOUNCE_MS)
  const quote = useQuery({
    queryKey: ["quote", routeId, dollarsForQuote],
    queryFn: () =>
      api<{ amountInFormatted: string; timeEstimate: number }>(
        `/api/quote?amount=${encodeURIComponent(dollarsForQuote)}&route=${routeId}`,
      ),
    enabled: rail === "oneclick" && Boolean(dollarsForQuote),
    retry: false,
    placeholderData: (previous) => previous,
  })

  const account = profile?.accounts.find((entry) => entry.network === network)
  const tegata: TegataState = !ready
    ? { kind: "loading" }
    : !authenticated
      ? { kind: "signed_out" }
      : !profile
        ? { kind: "loading" }
        : !profile.user.handle || !account?.readyAt
          ? { kind: "no_account" }
          : account.accountId === request.receiverId
            ? { kind: "own_link", accountId: account.accountId }
            : {
                kind: "ready",
                accountId: account.accountId,
                balance: viewDollars(account.balance ?? "0"),
              }

  const begin = (paymentId: string, used: PaymentRail) => {
    setAttemptId(paymentId)
    setUsedRail(used)
    setStartedAt(Date.now())
    setStep("paying")
  }

  async function payTegata() {
    if (!due) return
    setBusy(true)
    setProblem(null)
    try {
      const res = await api<TegataAttempt>(`/api/pay/${request.token}/attempts`, {
        body: { rail: "tegata", amount: request.amount === null ? amount : undefined },
      })
      // Check the transfer is exactly this link's before the key signs it.
      const { draftMatchesHash } = await import("@tegata/core/near")
      const call = res.draft.calls[0]
      const args = call
        ? (JSON.parse(call.argsJson) as { receiver_id?: string; amount?: string; memo?: string })
        : {}
      if (
        !draftMatchesHash(res.draft) ||
        res.draft.receiverId !== request.usdc ||
        res.draft.calls.length !== 1 ||
        call?.method !== "ft_transfer" ||
        args.receiver_id !== request.receiverId ||
        args.amount !== due.toString() ||
        args.memo !== `tegata:pay:${res.paymentId}`
      ) {
        throw new Error("The payment to approve doesn't match this link")
      }
      const signature = await key.sign(res.draft.hash)
      await api("/api/relay/sign", { body: { relayId: res.relayId, signature } })
      begin(res.paymentId, "tegata")
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(error instanceof Error ? error.message : "Couldn't start the payment")
    } finally {
      setBusy(false)
    }
  }

  async function payWallet() {
    if (!due || !walletAccount) return
    setBusy(true)
    setProblem(null)
    let sent = false
    try {
      const res = await api<WalletAttempt>(`/api/pay/${request.token}/attempts`, {
        body: {
          rail: "near_wallet",
          amount: request.amount === null ? amount : undefined,
          payer: walletAccount,
        },
      })
      if (res.receiverId !== request.receiverId || res.amount !== due.toString()) {
        throw new Error("The payment doesn't match this link")
      }
      const { sendCall } = await import("@/lib/client/near-wallet")
      const hash = await sendCall(
        walletAccount,
        {
          receiverId: request.usdc,
          methodName: "ft_transfer",
          args: { receiver_id: res.receiverId, amount: res.amount, memo: res.memo },
          gas: GAS.ftTransfer,
          deposit: ONE_YOCTO,
        },
        network,
      )
      sent = true
      const claim = { paymentId: res.paymentId, txHash: hash, payer: walletAccount }
      saveClaim(request.token, claim)
      begin(res.paymentId, "near_wallet")
      await submitClaim(claim)
      clearClaim(request.token)
    } catch (error) {
      fire("fail", { cue: "error" })
      if (sent) {
        setProblem(
          "Your wallet sent it, but this page lost its connection. Reopen this link to finish checking it.",
        )
        setStep("failed")
      } else setProblem(error instanceof ApiError ? error.message : walletProblem(error))
    } finally {
      setBusy(false)
    }
  }

  // A wallet payment whose hash never reached the server (closed tab, dropped connection): finish it now.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per link on load.
  useEffect(() => {
    const claim = loadClaim(request.token)
    if (!claim) return
    begin(claim.paymentId, "near_wallet")
    void submitClaim(claim)
      .then(() => clearClaim(request.token))
      .catch(() => undefined)
  }, [request.token])

  async function connect() {
    setConnecting(true)
    setProblem(null)
    try {
      const { connectNearAccount } = await import("@/lib/client/near-wallet")
      setWalletAccount(await connectNearAccount(network))
      fire("tick", { cue: "confirmed" })
    } catch (error) {
      setProblem(walletProblem(error))
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect() {
    const { disconnectNear } = await import("@/lib/client/near-wallet")
    await disconnectNear(network).catch(() => undefined)
    setWalletAccount(null)
  }

  const relay = attempt.data?.relayStatus
  const progress =
    status === "succeeded" ? 3 : usedRail === "near_wallet" ? 1 : relay === "success" ? 2 : 1

  return (
    <PayView
      request={request}
      amount={amount}
      onAmount={(v) => {
        setAmount(v)
        setProblem(null)
      }}
      rail={rail}
      onRail={(next) => {
        setRail(next)
        setProblem(null)
      }}
      step={step}
      tegata={tegata}
      onSignIn={() => {
        rememberNext(`/pay/${request.token}`)
        router.push("/signin")
      }}
      onFinishAccount={() => {
        rememberNext(`/pay/${request.token}`)
        router.push("/welcome")
      }}
      walletAccount={walletAccount}
      connecting={connecting}
      onConnect={connect}
      onDisconnect={disconnect}
      routes={routes}
      routeId={routeId}
      onRoute={setRouteId}
      quote={{
        data: quote.data,
        loading: quote.isFetching,
        error: quote.error
          ? quote.error instanceof ApiError
            ? quote.error.message
            : "No route right now"
          : undefined,
      }}
      busy={busy || (rail === "tegata" && !key.ready)}
      problem={problem}
      onPayTegata={payTegata}
      onPayWallet={payWallet}
      usedRail={usedRail}
      progress={progress}
      startedAt={startedAt}
      attempt={attempt.data ?? null}
      testDollars={network === "testnet" ? testDollars : undefined}
      onAddTestDollars={testDollars.add}
      onTryAgain={() => {
        setProblem(null)
        setAttemptId(null)
        setStep("choose")
      }}
    />
  )
}
