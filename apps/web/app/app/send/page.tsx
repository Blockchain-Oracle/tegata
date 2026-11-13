"use client"

// Send: the logic behind SendView. The server builds the transfer; this page re-encodes it, checks it is exactly what
// the person reviewed, signs the hash with the Privy-held key, and follows the relay to its final state.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { NETWORKS } from "@tegata/config"
import { toUnits } from "@tegata/core/money"
import { useEffect, useState } from "react"

import { viewDollars } from "@/components/kit/figure"
import { Segmented } from "@/components/kit/segmented"
import { ChainSend } from "@/components/send/chain-send"
import { type SendStep, SendView } from "@/components/send/send-view"
import { useShell } from "@/components/shell/shell-context"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { useSigner } from "@/hooks/use-signer"
import { ApiError, api } from "@/lib/client/api"
import type { RelayStatus, SendDraft, TeamPerson } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const POLL_MS = 1_200
const TERMINAL: RelayStatus["status"][] = ["success", "failed", "expired"]

export default function SendPage() {
  const network = useNetwork()
  const [mode, setMode] = useState<"near" | "chain">("near")
  // Balance's "Move out" in Live opens straight on another chain.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "chain") setMode("chain")
  }, [])
  // Live only: NEAR Intents has no testnet, so Sandbox sends stay on NEAR.
  const switcher =
    network === "mainnet" ? (
      <Segmented
        label="Send to"
        value={mode}
        onValueChange={(v) => setMode(v as "near" | "chain")}
        options={[
          { value: "near", label: "A NEAR account" },
          { value: "chain", label: "Another chain" },
        ]}
      />
    ) : null
  if (network === "mainnet" && mode === "chain") return <ChainSend switcher={switcher} />
  return <NearSend switcher={switcher} />
}

function NearSend({ switcher }: { switcher: React.ReactNode }) {
  const { profile } = useProfile()
  const { openReceive } = useShell()
  const signer = useSigner()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<SendStep>("form")
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [send, setSend] = useState<SendDraft | null>(null)

  const network = useNetwork()
  const account = profile?.accounts.find((entry) => entry.network === network)
  const balance = viewDollars(account?.balance ?? "0")

  // Ready people on your team, so a one-off payment to one of them is a tap.
  const team = useQuery({
    queryKey: ["people"],
    queryFn: () => api<{ people: TeamPerson[] }>("/api/people"),
    select: (data) =>
      data.people.flatMap((person) =>
        person.ready.state === "ready"
          ? [{ id: person.id, name: person.name, accountId: person.ready.accountId }]
          : [],
      ),
  })

  const relay = useQuery({
    queryKey: ["relay", send?.relayId],
    queryFn: () => api<RelayStatus>(`/api/relay/${send?.relayId}`),
    enabled: step === "sending" && Boolean(send),
    refetchInterval: (query) =>
      query.state.data && TERMINAL.includes(query.state.data.status) ? false : POLL_MS,
  })

  const status = relay.data?.status
  useEffect(() => {
    if (step !== "sending") return
    if (status === "success") {
      void queryClient.invalidateQueries({ queryKey: ["me"] })
      void queryClient.invalidateQueries({ queryKey: ["activity"] })
      setStep("sent")
    } else if (status === "failed" || status === "expired") {
      fire("fail", { cue: "error" })
      setProblem(relay.data?.error ?? "NEAR didn't accept it.")
      setStep("failed")
    }
  }, [status, step, queryClient, relay.data?.error])

  async function review() {
    setProblem(null)
    setBusy(true)
    try {
      const draft = await api<SendDraft>("/api/sends", {
        body: { network, to: to.trim(), amount: amount.trim() },
      })
      setSend(draft)
      setStep("review")
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(
        error instanceof ApiError ? error.message : "Couldn't prepare the payment. Try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (!send) return
    setBusy(true)
    setProblem(null)
    try {
      // Rebuild the action here and check it is exactly what the screen shows before signing.
      const { draftMatchesHash } = await import("@tegata/core/near")
      const call = send.draft.calls[0]
      const args = call
        ? (JSON.parse(call.argsJson) as { receiver_id?: string; amount?: string })
        : {}
      const expected = toUnits(amount.trim()).toString()
      if (
        !draftMatchesHash(send.draft) ||
        send.draft.calls.length !== 1 ||
        call?.method !== "ft_transfer" ||
        args.receiver_id !== to.trim().toLowerCase() ||
        args.amount !== expected
      ) {
        throw new Error("The payment to approve does not match what you entered")
      }
      const [approval] = await signer.approve([send])
      await api("/api/relay/sign", { body: approval })
      setStep("sending")
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(error instanceof Error ? error.message : "Couldn't approve the payment")
    } finally {
      setBusy(false)
    }
  }

  const progress =
    status === "success"
      ? 3
      : status === "sent" || status === "unknown"
        ? 2
        : step === "sending"
          ? 1
          : 0

  return (
    <SendView
      step={step}
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
      suffix={`.${NETWORKS[network].operator}`}
      busy={busy || !signer.ready}
      problem={problem}
      progress={progress}
      explorerUrl={relay.data?.explorerUrl ?? null}
      relayId={send?.relayId ?? null}
      onReview={review}
      onApprove={approve}
      onEdit={() => {
        setStep("form")
        setProblem(null)
      }}
      onReceive={openReceive}
      team={team.data}
      switcher={switcher}
      onAgain={() => {
        setSend(null)
        setAmount("")
        setStep("form")
      }}
    />
  )
}
