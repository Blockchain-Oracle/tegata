"use client"

// Bank: the logic behind BankView. A live quote from Noah while the form is filled; Review commits (Noah checks the bank
// details and sets its payout rule) and drafts one gas-free USDC transfer to Tegata's operator; before signing, the
// page rebuilds that transfer and checks it is exactly the amount, to the operator, with this withdrawal's memo; then it
// follows the withdrawal to the bank.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { NETWORKS } from "@tegata/config"
import { toUnits } from "@tegata/core/money"
import type { DelegateDraft } from "@tegata/core/near"
import { useEffect, useState } from "react"

import {
  type BankDepositView,
  type BankDetailsView,
  type BankPayoutView,
  type BankQuoteView,
  type BankStep,
  BankView,
  type FormSchema,
} from "@/components/bank/bank-view"
import { viewDollars } from "@/components/kit/figure"
import { Skeleton } from "@/components/kit/states"
import { useDebounced } from "@/hooks/use-debounced"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { useSigner } from "@/hooks/use-signer"
import { ApiError, api } from "@/lib/client/api"
import { checkDraft } from "@/lib/client/sign-relay"
import { fire } from "@/lib/feedback"

interface Overview {
  network: "testnet" | "mainnet"
  available: boolean
  countries: { code: string; fiat: string; name: string }[]
  saved: { id: string; country: string; fiat: string; label: string }[]
  payouts: BankPayoutView[]
  details: BankDetailsView | null
  deposits: BankDepositView[]
}

const POLL_MS = 2_500
const PROGRESS: Record<BankPayoutView["status"], number> = {
  drafted: 1,
  sending: 1,
  converting: 2,
  paying: 3,
  paid: 4,
  failed: 1,
}
const message = (error: unknown, fallback: string) =>
  error instanceof ApiError || error instanceof Error ? error.message : fallback

export default function BankPage() {
  const network = useNetwork()
  const { profile } = useProfile()
  const signer = useSigner()
  const queryClient = useQueryClient()
  const [country, setCountry] = useState("NG")
  const [amount, setAmount] = useState("")
  const [accountId, setAccountId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [step, setStep] = useState<BankStep>("form")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  /** Noah's bank check found who holds the account: shown for the business to confirm. */
  const [holder, setHolder] = useState<string | null>(null)
  const [committed, setCommitted] = useState<{
    payout: BankPayoutView
    relayId: string
    draft: DelegateDraft
    operator: string
  } | null>(null)

  const overview = useQuery({
    queryKey: ["bank", network],
    queryFn: () => api<Overview>("/api/bank"),
    refetchInterval: 10_000,
  })
  const available = overview.data?.available ?? false

  // A saved account for the country is the default; none means a new one.
  const savedHere = overview.data?.saved.filter((a) => a.country === country) ?? []
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-pick only when the country or the saved list changes.
  useEffect(() => {
    setAccountId((current) =>
      current && savedHere.some((a) => a.id === current) ? current : (savedHere[0]?.id ?? null),
    )
  }, [country, savedHere.length])

  const quoteInput = useDebounced({ country, amount: amount.trim() }, 400)
  const quote = useQuery({
    queryKey: ["bank-quote", quoteInput.country, quoteInput.amount],
    queryFn: () =>
      api<BankQuoteView>(
        `/api/bank/quote?country=${quoteInput.country}&amount=${encodeURIComponent(quoteInput.amount || "0")}`,
      ),
    // Asked even before an amount is typed: the channel it names is what the bank's form is read from.
    enabled: available,
    staleTime: 20_000,
    retry: false,
  })
  const channel = quote.data?.channelId
  const schema = useQuery({
    queryKey: ["bank-form", channel],
    queryFn: () =>
      api<{ schema: FormSchema }>(`/api/bank/form?channel=${encodeURIComponent(channel ?? "")}`),
    enabled: Boolean(channel) && accountId === null,
    staleTime: 10 * 60_000,
    select: (d) => d.schema,
  })

  const tracked = useQuery({
    queryKey: ["bank-payout", committed?.payout.id],
    queryFn: () => api<{ payout: BankPayoutView }>(`/api/bank/payouts/${committed?.payout.id}`),
    enabled: step === "sending" && Boolean(committed),
    refetchInterval: (q) =>
      q.state.data &&
      (q.state.data.payout.status === "paid" || q.state.data.payout.status === "failed")
        ? false
        : POLL_MS,
  })
  const payout = tracked.data?.payout ?? committed?.payout ?? null
  const status = tracked.data?.payout.status
  useEffect(() => {
    if (step !== "sending" || !status) return
    if (status === "paid") {
      void queryClient.invalidateQueries({ queryKey: ["me"] })
      void queryClient.invalidateQueries({ queryKey: ["bank", network] })
      setStep("paid")
    } else if (status === "failed") {
      fire("fail", { cue: "error" })
      setProblem(tracked.data?.payout.error ?? null)
      void queryClient.invalidateQueries({ queryKey: ["bank", network] })
      setStep("failed")
    }
  }, [status, step, queryClient, network, tracked.data?.payout.error])

  const details = useMutation({
    mutationFn: () => api("/api/bank/details", { method: "POST" }),
    onSuccess: () => {
      fire("tick", { cue: "confirmed" })
      void overview.refetch()
    },
    onError: () => fire("fail", { cue: "error" }),
  })
  const simulate = useMutation({
    mutationFn: (value: string) => api("/api/bank/details/simulate", { body: { amount: value } }),
    onSuccess: () => fire("tick", { cue: "confirmed" }),
    onError: () => fire("fail", { cue: "error" }),
  })

  async function review(confirmName?: string) {
    setProblem(null)
    setBusy(true)
    try {
      const res = await api<{
        payout: BankPayoutView
        relayId: string
        draft: DelegateDraft
        operator: string
      }>("/api/bank/payouts", {
        body: {
          country,
          amount: amount.trim(),
          ...(accountId ? { payoutAccountId: accountId } : { form }),
          ...(confirmName ? { confirmName } : {}),
        },
      })
      const label =
        overview.data?.saved.find((a) => a.id === accountId)?.label ??
        (() => {
          const d = (form as { BankDetails?: { Bank?: string; AccountNumber?: string } })
            .BankDetails
          return `${d?.Bank ?? "Bank account"} ••${(d?.AccountNumber ?? "").slice(-4)}`
        })()
      setCommitted({ ...res, payout: { ...res.payout, account: label } })
      setHolder(null)
      setStep("review")
    } catch (error) {
      if (error instanceof ApiError && error.code === "confirm") {
        fire("tick", { cue: "step" })
        setHolder(error.message)
        return
      }
      fire("fail", { cue: "error" })
      setProblem(message(error, "Couldn't prepare the withdrawal. Try again."))
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (!committed) return
    setBusy(true)
    setProblem(null)
    try {
      // The one thing this signature allows: exactly this many USDC to Tegata's operator, tagged for this withdrawal.
      await checkDraft(committed.draft, {
        receiverId: NETWORKS[network].usdc,
        method: "ft_transfer",
        args: {
          receiver_id: NETWORKS[network].operator,
          amount: toUnits(amount.trim()).toString(),
          memo: `tegata:bank:${committed.payout.id}`,
        },
      })
      if (committed.operator !== NETWORKS[network].operator)
        throw new Error("The withdrawal goes to the wrong account")
      const [approval] = await signer.approve([
        { relayId: committed.relayId, draft: committed.draft },
      ])
      await api("/api/relay/sign", { body: approval })
      setStep("sending")
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(message(error, "Couldn't approve the withdrawal"))
    } finally {
      setBusy(false)
    }
  }

  const account = profile?.accounts.find((entry) => entry.network === network)
  if (!overview.data)
    return (
      <div
        className="mx-auto flex w-full max-w-[640px] flex-col gap-6"
        role="status"
        aria-label="Loading Bank"
      >
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-[220px] rounded-[24px]" />
        <Skeleton className="h-[160px] rounded-[24px]" />
      </div>
    )
  return (
    <BankView
      available={available}
      businessName={profile?.workspace?.name ?? "Your business"}
      balance={viewDollars(account?.balance ?? "0")}
      countries={overview.data.countries}
      country={country}
      onCountry={(c) => {
        setHolder(null)
        setCountry(c)
        setForm({})
        setProblem(null)
      }}
      amount={amount}
      onAmount={(v) => {
        setAmount(v)
        setProblem(null)
      }}
      saved={overview.data.saved}
      accountId={accountId}
      onAccount={setAccountId}
      schema={accountId === null ? (schema.isError ? null : schema.data) : null}
      form={form}
      onForm={setForm}
      quote={{
        data: quote.data,
        error: quote.error ? message(quote.error, "Noah has no price right now") : null,
        loading: quote.isFetching,
      }}
      step={step}
      payout={payout}
      progress={status ? PROGRESS[status] : 1}
      busy={busy || !signer.ready}
      problem={problem}
      onReview={() => void review()}
      holder={holder}
      onConfirmHolder={() => {
        if (holder) void review(holder)
      }}
      onRejectHolder={() => {
        setHolder(null)
        setAccountId(null)
        setForm({})
      }}
      onApprove={approve}
      onEdit={() => {
        setStep("form")
        setProblem(null)
      }}
      onAgain={() => {
        setCommitted(null)
        setAmount("")
        setStep("form")
      }}
      details={overview.data.details}
      deposits={overview.data.deposits}
      onGetDetails={() => details.mutate()}
      gettingDetails={details.isPending}
      onSimulate={(value) => simulate.mutate(value)}
      simulating={simulate.isPending}
      simulated={simulate.isSuccess}
      recent={overview.data.payouts}
    />
  )
}
