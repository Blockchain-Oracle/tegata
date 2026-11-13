"use client"

// Cards: the logic behind CardsView. Tegata's own cards (issued by Bitnob, filled from the USDC on NEAR), the card
// panel, creating a card and moving money on and off it. Every fill is one gas-free transfer to Tegata's card reserve:
// before signing, the page rebuilds it and checks it is exactly that amount, to the reserve, tagged for that move.
// A crypto card the business already has (Gnosis Pay) is topped up from a sheet.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { NETWORKS } from "@tegata/config"
import { toUnits } from "@tegata/core/money"
import type { DelegateDraft } from "@tegata/core/near"
import { useEffect, useState } from "react"

import { CardMoneySheet } from "@/components/cards/card-money-sheet"
import { CardPanel } from "@/components/cards/card-panel"
import { CardsView } from "@/components/cards/cards-view"
import { type CardView, LinkedCards } from "@/components/cards/linked-cards"
import {
  type NewCardInput,
  NewCardSheet,
  type NewCardStep,
} from "@/components/cards/new-card-sheet"
import { viewDollars } from "@/components/kit/figure"
import { Sheet } from "@/components/shell/sheet"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { useSigner } from "@/hooks/use-signer"
import { ApiError, api } from "@/lib/client/api"
import { checkDraft } from "@/lib/client/sign-relay"
import type { CardMoveView, CardPurchaseView, IssuedCardView, TeamPerson } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

interface Drafted {
  relayId: string
  draft: DelegateDraft
  operator: string
}

const message = (error: unknown, fallback: string) =>
  error instanceof ApiError || error instanceof Error ? error.message : fallback

export default function CardsPage() {
  const network = useNetwork()
  const { profile } = useProfile()
  const signer = useSigner()
  const queryClient = useQueryClient()
  const business = profile?.workspace?.name ?? "Your business"
  const balance = viewDollars(profile?.accounts.find((a) => a.network === network)?.balance ?? "0")

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [step, setStep] = useState<NewCardStep>("form")
  const [progress, setProgress] = useState(0)
  const [madeId, setMadeId] = useState<string | null>(null)
  const [money, setMoney] = useState<"in" | "out" | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [linkedOpen, setLinkedOpen] = useState(false)

  const list = useQuery({
    queryKey: ["issued-cards", network],
    queryFn: () =>
      api<{ issuer: string | null; cards: IssuedCardView[]; purchases: CardPurchaseView[] }>(
        "/api/cards/issued",
      ),
    refetchInterval: step === "making" ? 2_500 : 10_000,
  })
  const detail = useQuery({
    queryKey: ["issued-card", selectedId],
    queryFn: () =>
      api<{ card: IssuedCardView; purchases: CardPurchaseView[]; moves: CardMoveView[] }>(
        `/api/cards/issued/${selectedId}`,
      ),
    enabled: Boolean(selectedId),
    refetchInterval: 5_000,
  })
  const team = useQuery({
    queryKey: ["people"],
    queryFn: () => api<{ people: TeamPerson[] }>("/api/people"),
    select: (d) => d.people,
  })
  const linked = useQuery({
    queryKey: ["cards", network],
    queryFn: () => api<{ cards: CardView[] }>("/api/cards"),
    select: (d) => d.cards,
    enabled: linkedOpen,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["issued-cards", network] })
    void queryClient.invalidateQueries({ queryKey: ["issued-card"] })
    void queryClient.invalidateQueries({ queryKey: ["me"] })
  }

  // A new card turns active once the issuer made it: then the seal presses.
  const made = list.data?.cards.find((c) => c.id === madeId) ?? null
  useEffect(() => {
    if (step !== "making" || !made) return
    if (made.status === "active") {
      fire("confirm", { cue: "celebrate" })
      setProgress(3)
      setStep("done")
    } else if (made.status === "failed") {
      fire("fail", { cue: "error" })
      setProblem(made.error ?? "The card couldn't be made. Your money came back.")
    }
  }, [step, made])

  /** Check a fill's transfer is exactly this: `amount` USDC to Tegata's card reserve, memo `tegata:card:<move>`. */
  async function approveFill(d: Drafted, moveId: string, amount: string) {
    await checkDraft(d.draft, {
      receiverId: NETWORKS[network].usdc,
      method: "ft_transfer",
      args: {
        receiver_id: NETWORKS[network].operator,
        amount: toUnits(amount).toString(),
        memo: `tegata:card:${moveId}`,
      },
    })
    if (d.operator !== NETWORKS[network].operator)
      throw new Error("The fill goes to the wrong account")
    const [approval] = await signer.approve([{ relayId: d.relayId, draft: d.draft }])
    await api("/api/relay/sign", { body: approval })
  }

  async function create(input: NewCardInput) {
    setProblem(null)
    setBusy("Getting the card ready")
    try {
      const res = await api<Drafted & { card: IssuedCardView; moveId: string }>(
        "/api/cards/issued",
        {
          body: input,
        },
      )
      setMadeId(res.card.id)
      await approveFill(res, res.moveId, input.startWith)
      fire("tick", { cue: "sent" })
      setProgress(1)
      setStep("making")
      refresh()
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(message(error, "Couldn't make the card. Try again."))
    } finally {
      setBusy(null)
    }
  }

  async function moveMoney(amount: string) {
    if (!selectedId || !money) return
    setProblem(null)
    setBusy(money === "in" ? "Adding money" : "Moving back")
    try {
      const res = await api<Partial<Drafted> & { move: CardMoveView }>(
        `/api/cards/issued/${selectedId}/money`,
        {
          body: { direction: money, amount },
        },
      )
      if (money === "in" && res.draft && res.relayId && res.operator)
        await approveFill(res as Drafted, res.move.id, amount)
      fire("tick", { cue: money === "in" ? "sent" : "received" })
      setMoney(null)
      refresh()
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(message(error, "That didn't go through. Nothing moved."))
    } finally {
      setBusy(null)
    }
  }

  const control = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/api/cards/issued/${selectedId}/controls`, { body }),
    onMutate: () => setProblem(null),
    onSuccess: (_d, body) => {
      fire("tick", { cue: body.action === "freeze" ? "toggle" : "confirmed" })
      refresh()
    },
    onError: (error) => {
      fire("fail", { cue: "error" })
      setProblem(message(error, "That didn't go through"))
    },
  })
  const rename = useMutation({
    mutationFn: (nickname: string) =>
      api(`/api/cards/issued/${selectedId}`, { method: "PATCH", body: { nickname } }),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: () => api(`/api/cards/issued/${selectedId}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelectedId(null)
      setTimeout(refresh, 1_500)
    },
  })
  const link = useMutation({
    mutationFn: (input: { account: string; label: string }) => api("/api/cards", { body: input }),
    onSuccess: () => void linked.refetch(),
  })
  const unlink = useMutation({
    mutationFn: (id: string) => api(`/api/cards/${id}`, { method: "DELETE" }),
    onSuccess: () => void linked.refetch(),
  })

  const selected = detail.data?.card ?? list.data?.cards.find((c) => c.id === selectedId) ?? null

  return (
    <>
      <CardsView
        business={business}
        sandbox={network === "testnet"}
        issuer={list.data?.issuer ?? null}
        cards={list.data?.cards}
        purchases={list.data?.purchases ?? []}
        error={list.error ? message(list.error, "Cards didn't answer") : null}
        onRetry={() => void list.refetch()}
        selectedId={selectedId}
        onSelect={(id) => {
          setProblem(null)
          setSelectedId(id)
        }}
        onNewCard={() => {
          setStep("form")
          setProgress(0)
          setMadeId(null)
          setProblem(null)
          setCreating(true)
        }}
        onLinked={() => setLinkedOpen(true)}
      />
      {selectedId && !money ? (
        <CardPanel
          card={selected}
          business={business}
          sandbox={network === "testnet"}
          purchases={detail.data?.purchases}
          moves={detail.data?.moves}
          busy={
            busy ??
            (control.isPending ? "Telling the card issuer" : remove.isPending ? "Removing" : null)
          }
          problem={problem}
          onOpenChange={(o) => !o && setSelectedId(null)}
          onAddMoney={() => setMoney("in")}
          onMoveBack={() => setMoney("out")}
          onFreeze={(frozen) => control.mutate({ action: "freeze", frozen })}
          onLimit={(monthlyLimit) => control.mutate({ action: "limit", monthlyLimit })}
          onRename={(nickname) => rename.mutate(nickname)}
          onRemove={() => remove.mutate()}
          onTestPurchase={() => control.mutate({ action: "test-purchase" })}
        />
      ) : null}
      <CardMoneySheet
        open={money !== null}
        onOpenChange={(o) => !o && setMoney(null)}
        direction={money ?? "in"}
        card={selected}
        business={business}
        balance={balance}
        busy={busy !== null || !signer.ready}
        problem={problem}
        onConfirm={(amount) => void moveMoney(amount)}
      />
      <NewCardSheet
        open={creating}
        onOpenChange={(o) => {
          setCreating(o)
          if (!o) setStep("form")
        }}
        business={business}
        people={(team.data ?? []).map((p) => ({ id: p.id, name: p.name, email: p.email }))}
        cards={list.data?.cards ?? []}
        balance={balance}
        step={step}
        progress={progress}
        busy={busy !== null || !signer.ready}
        problem={problem}
        made={made}
        onCreate={(input) => void create(input)}
        onShowCard={(id) => {
          setCreating(false)
          setStep("form")
          setSelectedId(id)
        }}
      />
      <Sheet open={linkedOpen} onOpenChange={setLinkedOpen} title="Your crypto card">
        <LinkedCards
          live={network === "mainnet"}
          cards={linked.data}
          linking={link.isPending}
          problem={link.error ? message(link.error, "Couldn't link the card") : null}
          onLink={(input) => link.mutate(input)}
          onUnlink={(id) => unlink.mutate(id)}
        />
      </Sheet>
    </>
  )
}
