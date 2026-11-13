"use client"

// Cards: the logic behind CardsView. Linked cards with live balances read from the Gnosis chain.
import { useMutation, useQuery } from "@tanstack/react-query"

import { CardsView, type CardView } from "@/components/cards/cards-view"
import { Skeleton } from "@/components/kit/states"
import { useNetwork } from "@/hooks/use-network"
import { ApiError, api } from "@/lib/client/api"
import { fire } from "@/lib/feedback"

export default function CardsPage() {
  const network = useNetwork()
  const cards = useQuery({
    queryKey: ["cards", network],
    queryFn: () => api<{ cards: CardView[] }>("/api/cards"),
    select: (d) => d.cards,
    refetchInterval: 20_000,
  })
  const link = useMutation({
    mutationFn: (input: { account: string; label: string }) => api("/api/cards", { body: input }),
    onSuccess: () => {
      fire("tick", { cue: "confirmed" })
      void cards.refetch()
    },
    onError: () => fire("fail", { cue: "error" }),
  })
  const unlink = useMutation({
    mutationFn: (id: string) => api(`/api/cards/${id}`, { method: "DELETE" }),
    onSuccess: () => void cards.refetch(),
  })
  if (!cards.data)
    return (
      <div
        className="mx-auto flex w-full max-w-[720px] flex-col gap-6"
        role="status"
        aria-label="Loading cards"
      >
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-[260px] rounded-[24px]" />
      </div>
    )
  return (
    <CardsView
      live={network === "mainnet"}
      cards={cards.data}
      linking={link.isPending}
      problem={
        link.error instanceof ApiError
          ? link.error.message
          : link.error
            ? "Couldn't link the card"
            : null
      }
      onLink={(input) => link.mutate(input)}
      onUnlink={(id) => unlink.mutate(id)}
    />
  )
}
