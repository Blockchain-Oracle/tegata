"use client"

// The pay page's logic. Every rail ends the same way: the server reads the USDC transfer from NEAR and only then
// calls it paid. Nothing the browser says is believed.
//  · Tegata balance: the server drafts the transfer with the attempt's memo; this page checks the draft is exactly
//    this link's receiver, amount and memo, the Privy key signs it, and our relayer sends it gas-free.
//  · NEAR wallet: the wallet sends one `ft_transfer` with the memo; this page hands the hash to the server.
//  · Another chain: a live NEAR Intents quote; deposit addresses run in Live only (no testnet).
import { useQuery } from "@tanstack/react-query"
import { GAS, ONE_YOCTO } from "@tegata/config"
import { toUnits } from "@tegata/core/money"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { viewDollars } from "@/components/kit/figure"
import { openPayWindow } from "@/components/pay/checkout-frame"
import { type PayRoute, type PayStep, PayView, type TegataState } from "@/components/pay/pay-view"
import { useDebounced } from "@/hooks/use-debounced"
import { useProfile } from "@/hooks/use-profile"
import { useSigner } from "@/hooks/use-signer"
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
  embed,
}: {
  initial: PublicRequest
  routes: readonly PayRoute[]
  /** Opened over a merchant's site by checkout.js: the paid moment is told to that page (its origin only). */
  embed?: { parent: string | null }
}) {
  const router = useRouter()
  // Signed in by email (Privy) or with a NEAR wallet: either can pay from its Tegata balance.
  const { ready, authenticated, profile } = useProfile()
  const signer = useSigner()
  const testDollars = useTestDollars()
  const network = initial.network

  const [rail, setRail] = useState<PaymentRail | null>(network === "testnet" ? "tegata" : null)
  // "Add money from another chain" or "with a card" (Balance) opens this page with that option already chosen.
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("rail")
    if (asked === "chain") setRail("oneclick")
    if (asked === "card") setRail("card")
    // An any-amount link opened from a merchant's button arrives with the amount filled in (still editable).
    const given = new URLSearchParams(window.location.search).get("amount")
    if (given && initial.amount === null && /^\d{1,9}(\.\d{1,2})?$/.test(given)) setAmount(given)
  }, [initial.amount])
  const [amount, setAmount] = useState(() =>
    initial.invoice?.allowPartial ? viewDollars(initial.invoice.remaining).toFixed(2) : "",
  )
  const [step, setStep] = useState<PayStep>("choose")
  const [usedRail, setUsedRail] = useState<PaymentRail | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [walletAccount, setWalletAccount] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  // USDC on Base first: fast, cheap and with no floor, where Tron and BNB Chain have $100 and $1,000 minimums.
  const [routeId, setRouteId] = useState(
    routes.find((r) => r.id === "usdc-base")?.id ?? routes[0]?.id ?? "",
  )
  const [refundTo, setRefundTo] = useState("")
  const [receiptEmail, setReceiptEmail] = useState("")
  /** Transak's checkout, while it's open in the page. */
  const [cardUrl, setCardUrl] = useState<string | null>(null)

  const request = useQuery({
    queryKey: ["pay", initial.token],
    queryFn: () => api<PublicRequest>(`/api/pay/${initial.token}`),
    initialData: initial,
    staleTime: 30_000,
  }).data

  const invoice = request.invoice
  const typed = invoice ? invoice.allowPartial : request.amount === null
  const due = invoice
    ? invoice.allowPartial
      ? units(amount)
      : BigInt(invoice.remaining)
    : request.amount !== null
      ? BigInt(request.amount)
      : units(amount)

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

  // A pay window opened from a checkout frame: tell that frame (same origin only) which payment started here.
  useEffect(() => {
    if (!attemptId || !window.opener) return
    if (new URLSearchParams(window.location.search).get("opener") !== "1") return
    try {
      window.opener.postMessage(
        { type: "tegata:pay.started", token: initial.token, attemptId },
        window.location.origin,
      )
    } catch {
      // The opener went away: the merchant's page still gets the signed webhook.
    }
  }, [attemptId, initial.token])

  // The checkout frame: a payment started in its pay window is followed here like its own.
  useEffect(() => {
    if (!embed) return
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; token?: string; attemptId?: string }
      if (data?.type !== "tegata:pay.started" || data.token !== initial.token || !data.attemptId)
        return
      setAttemptId(data.attemptId)
      setStep("paying")
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [embed, initial.token])

  // Embedded: tell the merchant's page it was paid, for its own screens only (proof is the signed webhook).
  const paidAttempt = step === "paid" ? attempt.data : undefined
  useEffect(() => {
    const parent = embed?.parent
    if (!paidAttempt || !parent || window.parent === window) return
    window.parent.postMessage(
      {
        type: "tegata:checkout.completed",
        token: initial.token,
        detail: {
          paymentId: paidAttempt.id,
          amount: paidAttempt.amount,
          receipt: paidAttempt.receiptToken
            ? `${window.location.origin}/r/${paidAttempt.receiptToken}`
            : null,
        },
      },
      parent,
    )
  }, [paidAttempt, embed?.parent, initial.token])
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

  // Paying by card: is it open here, and what does the card pay (fee included)?
  const card = useQuery({
    queryKey: ["card-quote", request.token, dollarsForQuote],
    queryFn: () =>
      api<{
        open: boolean
        reason?: string
        quote?: { fiat: string; total: number; fee: number } | null
      }>(`/api/pay/${request.token}/card?amount=${encodeURIComponent(dollarsForQuote)}`),
    retry: false,
    staleTime: 30_000,
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
        body: { rail: "tegata", amount: typed ? amount : undefined },
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
      const [approval] = await signer.approve([res])
      await api("/api/relay/sign", { body: approval })
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
          amount: typed ? amount : undefined,
          payer: walletAccount,
          email: receiptEmail.trim(),
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

  /** Pay by card: a payment and Transak's checkout, locked to it, opened in the page. */
  async function payCard() {
    if (!due) return
    setBusy(true)
    setProblem(null)
    try {
      const res = await api<{ paymentId: string; widgetUrl: string }>(
        `/api/pay/${request.token}/card`,
        {
          body: { amount: typed ? amount : undefined, email: receiptEmail.trim() },
        },
      )
      fire("press", { cue: "tap" })
      begin(res.paymentId, "card")
      setCardUrl(res.widgetUrl)
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(
        error instanceof ApiError
          ? error.message
          : "Card payments are down right now. The other ways still work.",
      )
    } finally {
      setBusy(false)
    }
  }

  /** Tell Tegata the order the checkout made, so the worker can follow it (it checks the order names this payment). */
  const sendOrder = useCallback(async (paymentId: string, orderId: string) => {
    await api(`/api/pay/attempts/${paymentId}/card`, { body: { orderId } }).catch(() => undefined)
  }, [])

  // Transak's checkout speaks through postMessage: the order it made, and when it's done or closed.
  useEffect(() => {
    if (!cardUrl || !attemptId) return
    const onMessage = (event: MessageEvent) => {
      if (!/^https:\/\/([a-z0-9-]+\.)*transak\.com$/.test(event.origin)) return
      const data = event.data as {
        event_id?: string
        data?: { id?: string; status?: { id?: string } }
      }
      const orderId = data?.data?.id ?? data?.data?.status?.id
      if (
        orderId &&
        (data.event_id === "TRANSAK_ORDER_CREATED" || data.event_id === "TRANSAK_ORDER_SUCCESSFUL")
      )
        void sendOrder(attemptId, orderId)
      if (
        data.event_id === "TRANSAK_ORDER_SUCCESSFUL" ||
        data.event_id === "TRANSAK_WIDGET_CLOSE"
      ) {
        fire("tick", { cue: "step" })
        setCardUrl(null)
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [cardUrl, attemptId, sendOrder])

  // Back from Transak's own page (a redirect): `?card=<payment>&orderId=<order>` picks the payment up again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on arrival.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paymentId = params.get("card")
    const orderId = params.get("orderId")
    if (!paymentId) return
    begin(paymentId, "card")
    if (orderId) void sendOrder(paymentId, orderId)
  }, [])

  /** Live: ask NEAR Intents for a deposit address on the chosen coin and chain, then follow it. */
  async function payChain(walletAddress?: string) {
    if (!due) return
    if (walletAddress) setRefundTo(walletAddress)
    setBusy(true)
    setProblem(null)
    try {
      const res = await api<{ paymentId: string }>(`/api/pay/${request.token}/oneclick`, {
        body: {
          route: routeId,
          refundTo: (walletAddress ?? refundTo).trim(),
          amount: typed ? amount : undefined,
          email: receiptEmail.trim(),
        },
      })
      fire("press", { cue: "tap" })
      begin(res.paymentId, "oneclick")
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(
        error instanceof ApiError ? error.message : "NEAR Intents didn't answer. Try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    const { disconnectNear } = await import("@/lib/client/near-wallet")
    await disconnectNear(network).catch(() => undefined)
    setWalletAccount(null)
  }

  const relay = attempt.data?.relayStatus
  const cardCharged =
    status === "settling" ||
    Boolean(
      attempt.data?.card?.orderStatus?.match(/PAYMENT_DONE|PROCESSING|PENDING_DELIVERY|COMPLETED/),
    )
  const progress =
    status === "succeeded"
      ? 3
      : usedRail === "card"
        ? attempt.data?.card?.orderStatus === "COMPLETED"
          ? 2
          : cardCharged
            ? 1
            : 0
        : usedRail === "near_wallet"
          ? 1
          : relay === "success"
            ? 2
            : 1

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
        // Inside another site's frame, sign-in can't run (Tegata's pages refuse to be framed, and the browser keeps a
        // framed site's storage apart): it opens in the pay window, which reports the payment back to this frame.
        if (embed) {
          const back = new URLSearchParams({ opener: "1" })
          if (typed && amount) back.set("amount", amount)
          openPayWindow(
            request.token,
            `/signin?next=${encodeURIComponent(`/pay/${request.token}?${back}`)}`,
          )
          return
        }
        rememberNext(`/pay/${request.token}`)
        router.push("/signin")
      }}
      onFinishAccount={() => {
        if (embed) {
          openPayWindow(request.token)
          return
        }
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
      busy={busy || (rail === "tegata" && !signer.ready)}
      problem={problem}
      onPayTegata={payTegata}
      onPayWallet={payWallet}
      refundTo={refundTo}
      receiptEmail={receiptEmail}
      onReceiptEmail={setReceiptEmail}
      onRefundTo={(value) => {
        setRefundTo(value)
        setProblem(null)
      }}
      onPayChain={(walletAddress) => void payChain(walletAddress)}
      // A payer sees Card only where it's open: no "not set up yet" on someone's pay page.
      card={
        card.data?.open
          ? { open: true, quote: card.data.quote ?? null, loading: card.isFetching }
          : undefined
      }
      onPayCard={() => void payCard()}
      cardUrl={cardUrl}
      onCloseCard={() => setCardUrl(null)}
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
