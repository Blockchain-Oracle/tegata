"use client"

// Send to another chain, the logic behind ChainSendView. A live dry quote while the form is filled;
// Review commits a signed 1Click quote with its own deposit address and drafts one gas-free USDC transfer to it;
// before signing, the page rebuilds that transfer and checks it is exactly the amount to exactly that address; then
// it follows the payout to delivery on the other chain (the worker reads NEAR Intents). In the Sandbox the same form
// shows, with the reason it runs in Live (R5): NEAR Intents has no testnet, so nothing is quoted or sent.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { NETWORKS } from "@tegata/config"
import { toUnits } from "@tegata/core/money"
import { type ReactNode, useEffect, useState } from "react"

import { viewDollars } from "@/components/kit/figure"
import { type ChainSendStep, ChainSendView } from "@/components/send/chain-send-view"
import { useShell } from "@/components/shell/shell-context"
import { useDebounced } from "@/hooks/use-debounced"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { useSigner } from "@/hooks/use-signer"
import { ApiError, api } from "@/lib/client/api"
import type { PayoutDraft, PayoutPreview, PayoutView } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { addressLooksRight, PAYER_ROUTES } from "@/lib/routes"

const POLL_MS = 2_000
const TERMINAL: PayoutView["status"][] = ["delivered", "refunded", "failed"]

const PROGRESS: Record<PayoutView["status"], number> = {
  drafted: 1,
  sending: 2,
  processing: 3,
  delivered: 4,
  refunded: 4,
  failed: 1,
}

const message = (error: unknown, fallback: string) =>
  error instanceof ApiError || error instanceof Error ? error.message : fallback

export function ChainSend({
  switcher,
  initial,
}: {
  switcher?: ReactNode
  /** Filled from a scanned QR code: the route, the address and (for dollar coins) the amount. */
  initial?: { routeId?: string; to?: string; amount?: string }
}) {
  const { profile } = useProfile()
  const sandbox = useNetwork() !== "mainnet"
  const { openReceive, openScan } = useShell()
  const signer = useSigner()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<ChainSendStep>("form")
  const [routeId, setRouteId] = useState<string>(
    PAYER_ROUTES.some((r) => r.id === initial?.routeId)
      ? (initial?.routeId ?? "usdc-base")
      : "usdc-base",
  )
  const [to, setTo] = useState(initial?.to ?? "")
  const [amount, setAmount] = useState(initial?.amount ?? "")
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [committed, setCommitted] = useState<PayoutDraft | null>(null)

  const account = profile?.accounts.find(
    (entry) => entry.network === (sandbox ? "testnet" : "mainnet"),
  )
  const balance = viewDollars(account?.balance ?? "0")
  const route = PAYER_ROUTES.find((r) => r.id === routeId) ?? PAYER_ROUTES[0]

  // One quote per pause in typing, only once the address could be right.
  const quoteInput = useDebounced({ routeId, to: to.trim(), amount: amount.trim() }, 450)
  const quotable =
    !sandbox &&
    step === "form" &&
    Number.parseFloat(quoteInput.amount || "0") > 0 &&
    addressLooksRight(route.chainMark, quoteInput.to) &&
    quoteInput.routeId === routeId
  const preview = useQuery({
    queryKey: ["payout-preview", quoteInput.routeId, quoteInput.to, quoteInput.amount],
    queryFn: () =>
      api<PayoutPreview>(
        `/api/payouts/preview?route=${quoteInput.routeId}&to=${encodeURIComponent(quoteInput.to)}&amount=${encodeURIComponent(quoteInput.amount)}`,
      ),
    enabled: quotable,
    staleTime: 20_000,
    retry: false,
  })

  const tracked = useQuery({
    queryKey: ["payout", committed?.payout.id],
    queryFn: () => api<{ payout: PayoutView }>(`/api/payouts/${committed?.payout.id}`),
    enabled: step === "sending" && Boolean(committed),
    refetchInterval: (query) =>
      query.state.data && TERMINAL.includes(query.state.data.payout.status) ? false : POLL_MS,
  })
  const payout = tracked.data?.payout ?? committed?.payout ?? null
  const status = tracked.data?.payout.status

  useEffect(() => {
    if (step !== "sending" || !status) return
    if (status === "delivered") {
      void queryClient.invalidateQueries({ queryKey: ["me"] })
      void queryClient.invalidateQueries({ queryKey: ["activity"] })
      setStep("delivered")
    } else if (status === "refunded") {
      fire("fail", { cue: "error" })
      void queryClient.invalidateQueries({ queryKey: ["me"] })
      setStep("refunded")
    } else if (status === "failed") {
      fire("fail", { cue: "error" })
      setProblem(tracked.data?.payout.error ?? "NEAR didn't accept the transfer.")
      setStep("failed")
    }
  }, [status, step, queryClient, tracked.data?.payout.error])

  async function review() {
    if (sandbox) return
    setProblem(null)
    setBusy(true)
    try {
      const draft = await api<PayoutDraft>("/api/payouts", {
        body: { route: routeId, to: to.trim(), amount: amount.trim() },
      })
      setCommitted(draft)
      setStep("review")
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(message(error, "Couldn't prepare the payment. Try again."))
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (sandbox || !committed || !account) return
    setBusy(true)
    setProblem(null)
    try {
      // The one thing this signature allows: exactly this many USDC from your account to this deposit address.
      const { draftMatchesHash } = await import("@tegata/core/near")
      const { draft, depositAddress } = committed
      const call = draft.calls[0]
      const args = call
        ? (JSON.parse(call.argsJson) as { receiver_id?: string; amount?: string; memo?: string })
        : {}
      if (
        !draftMatchesHash(draft) ||
        draft.network !== "mainnet" ||
        draft.senderId !== account.accountId ||
        draft.receiverId !== NETWORKS.mainnet.usdc ||
        draft.calls.length !== 1 ||
        call?.method !== "ft_transfer" ||
        args.receiver_id !== depositAddress ||
        args.memo !== undefined ||
        args.amount !== toUnits(amount.trim()).toString() ||
        committed.payout.recipient !== to.trim()
      ) {
        throw new Error("The payment to approve does not match what you entered")
      }
      const [approval] = await signer.approve([{ relayId: committed.relayId, draft }])
      await api("/api/relay/sign", { body: approval })
      setStep("sending")
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(message(error, "Couldn't approve the payment"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ChainSendView
      step={step}
      routes={PAYER_ROUTES}
      routeId={routeId}
      onRoute={(id) => {
        setRouteId(id)
        setProblem(null)
      }}
      to={to}
      onTo={(v) => {
        setTo(v)
        setProblem(null)
      }}
      amount={amount}
      onAmount={(v) => {
        setAmount(v)
        setProblem(null)
      }}
      balance={balance}
      businessName={profile?.workspace?.name ?? "Your business"}
      preview={{
        data: quotable ? preview.data : undefined,
        error: preview.error ? message(preview.error, "No route right now") : null,
        loading: preview.isFetching,
      }}
      payout={payout}
      progress={status ? PROGRESS[status] : 1}
      busy={busy || !signer.ready}
      problem={problem}
      switcher={switcher}
      sandbox={sandbox}
      onScan={openScan}
      onReview={review}
      onApprove={approve}
      onEdit={() => {
        setStep("form")
        setProblem(null)
      }}
      onAgain={() => {
        setCommitted(null)
        setAmount("")
        setTo("")
        setStep("form")
      }}
      onReceive={openReceive}
    />
  )
}
