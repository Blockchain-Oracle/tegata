"use client"

// Team: approvers and the team treasury. Every action the owner signs (the seal, money into the treasury) is checked
// here first: the seal goes to this business's own treasury only, a transfer moves exactly the amount typed to it.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { DelegateDraft } from "@tegata/core/near"
import { useState } from "react"

import { type TeamData, TeamView } from "@/components/team/team-view"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { useSigner } from "@/hooks/use-signer"
import { ApiError, api } from "@/lib/client/api"
import { fire } from "@/lib/feedback"

const POLL_MS = 3_000
const UNITS_PER_CENT = 10_000n

const problemOf = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback

export default function TeamPage() {
  const network = useNetwork()
  const { profile } = useProfile()
  const signer = useSigner()
  const queryClient = useQueryClient()
  const [lastInvite, setLastInvite] = useState<{
    name: string
    email: string
    link: string
  } | null>(null)

  const team = useQuery({
    queryKey: ["team", network],
    queryFn: () => api<TeamData>("/api/team"),
    refetchInterval: (query) => {
      const status = query.state.data?.treasury?.status
      return status === "creating" || status === "sealing" ? POLL_MS : false
    },
  })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["team", network] })

  const invite = useMutation({
    mutationFn: (input: { name: string; email: string }) =>
      api<{ id: string; token: string }>("/api/team", { body: input }),
    onSuccess: (res, input) => {
      fire("tick", { cue: "confirmed" })
      setLastInvite({
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        link: `${window.location.origin}/team/${res.token}`,
      })
      refresh()
    },
    onError: () => fire("fail", { cue: "error" }),
  })
  const remove = useMutation({
    mutationFn: (memberId: string) => api(`/api/team/${memberId}`, { method: "DELETE" }),
    onSettled: refresh,
  })
  const open = useMutation({
    mutationFn: (threshold: number) => api("/api/team/open", { body: { threshold } }),
    onSuccess: () => {
      fire("tick", { cue: "confirmed" })
      refresh()
    },
    onError: () => fire("fail", { cue: "error" }),
  })

  /** Sign one drafted treasury action after checking it is what the screen says. */
  async function signChecked(
    draft: { relayId: string; draft: DelegateDraft },
    check: (d: DelegateDraft) => boolean,
  ) {
    const { draftMatchesHash } = await import("@tegata/core/near")
    if (!draftMatchesHash(draft.draft) || !check(draft.draft))
      throw new Error("The action to approve doesn't match what you see")
    const [approval] = await signer.approve([draft])
    if (!approval) throw new Error("Nothing was signed")
    await api("/api/team/sign", { body: approval })
  }

  const seal = useMutation({
    mutationFn: async () => {
      const treasury = team.data?.treasury
      if (!treasury) throw new Error("No treasury to seal")
      const draft = await api<{ relayId: string; draft: DelegateDraft }>("/api/team/seal", {
        method: "POST",
      })
      await signChecked(
        draft,
        (d) =>
          d.receiverId === treasury.accountId &&
          d.calls.length === 4 &&
          d.calls.every(
            (c) =>
              (c.method === "add_proposal" || c.method === "act_proposal") && c.deposit === "0",
          ),
      )
    },
    onSuccess: () => {
      fire("confirm", { cue: "stamp" })
      refresh()
    },
    onError: () => fire("fail", { cue: "error" }),
  })

  const fund = useMutation({
    mutationFn: async (amount: string) => {
      const treasury = team.data?.treasury
      if (!treasury) throw new Error("No treasury")
      const [whole = "0", cents = ""] = amount.split(".")
      const units = (BigInt(whole) * 100n + BigInt(cents.padEnd(2, "0") || "0")) * UNITS_PER_CENT
      const draft = await api<{ relayId: string; draft: DelegateDraft }>("/api/team/fund", {
        body: { amount },
      })
      await signChecked(draft, (d) => {
        const call = d.calls[0]
        const args = call
          ? (JSON.parse(call.argsJson) as { receiver_id?: string; amount?: string })
          : {}
        return (
          d.calls.length === 1 &&
          call?.method === "ft_transfer" &&
          args.receiver_id === treasury.accountId &&
          args.amount === units.toString()
        )
      })
    },
    onSuccess: () => {
      fire("confirm", { cue: "sent" })
      setTimeout(refresh, POLL_MS)
    },
    onError: () => fire("fail", { cue: "error" }),
  })

  return (
    <TeamView
      data={team.data}
      business={profile?.workspace?.name ?? "Your business"}
      network={network}
      error={team.isError && !team.data}
      onRetry={() => void team.refetch()}
      inviting={invite.isPending}
      inviteProblem={invite.error ? problemOf(invite.error, "Couldn't add them") : null}
      lastInvite={lastInvite}
      onInvite={(input) => invite.mutate(input)}
      onRemove={(id) => remove.mutate(id)}
      opening={open.isPending}
      openProblem={open.error ? problemOf(open.error, "Couldn't open the treasury") : null}
      onOpen={(threshold) => open.mutate(threshold)}
      sealing={seal.isPending || !signer.ready}
      sealProblem={seal.error ? problemOf(seal.error, "The seal didn't go through") : null}
      onSeal={() => seal.mutate()}
      funding={fund.isPending}
      fundProblem={fund.error ? problemOf(fund.error, "That didn't go through") : null}
      onFund={(amount) => fund.mutate(amount)}
    />
  )
}
