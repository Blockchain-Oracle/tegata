"use client"

// One payroll waiting on approvals. Before the key signs a vote, the browser checks it is a vote on exactly this
// proposal, on this business's treasury, whose transfers are the rows on screen.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { DelegateDraft } from "@tegata/core/near"
import { useRouter } from "next/navigation"
import { use } from "react"

import { type ApprovalDetail, ApprovalDetailView } from "@/components/team/approvals-view"
import { useSigner } from "@/hooks/use-signer"
import { ApiError, api } from "@/lib/client/api"
import { voteDraftMatches } from "@/lib/client/treasury-check"
import { fire } from "@/lib/feedback"

const POLL_MS = 3_000

export default function ApprovalPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params)
  const router = useRouter()
  const signer = useSigner()
  const queryClient = useQueryClient()
  const detail = useQuery({
    queryKey: ["approval", runId],
    queryFn: () => api<ApprovalDetail>(`/api/approvals/${runId}`),
    refetchInterval: (query) =>
      query.state.data?.status === "proposed" || query.state.data?.status === "approved"
        ? POLL_MS
        : false,
  })

  const vote = useMutation({
    mutationFn: async (choice: "approve" | "reject") => {
      const shown = detail.data
      if (!shown || shown.proposalId === null) throw new Error("Nothing to vote on")
      const prepared = await api<{ relayId: string; draft: DelegateDraft; usdc: string }>(
        `/api/approvals/${runId}`,
        { body: { vote: choice } },
      )
      const { draftMatchesHash } = await import("@tegata/core/near")
      const onScreen = shown.rows.filter((row) => row.status === "included")
      if (
        !draftMatchesHash(prepared.draft) ||
        !voteDraftMatches(
          prepared.draft,
          shown.treasury,
          prepared.usdc,
          shown.proposalId,
          choice,
          onScreen,
        )
      )
        throw new Error("The vote to sign doesn't match this payroll")
      const [approval] = await signer.approve([prepared])
      if (!approval) throw new Error("Nothing was signed")
      await api(`/api/approvals/${runId}`, { method: "PUT", body: { vote: choice, approval } })
    },
    onSuccess: (_r, choice) => {
      fire("confirm", { cue: choice === "approve" ? "sent" : "tap" })
      void queryClient.invalidateQueries({ queryKey: ["approval", runId] })
      void queryClient.invalidateQueries({ queryKey: ["approvals"] })
    },
    onError: () => fire("fail", { cue: "error" }),
  })

  const sendAgain = useMutation({
    mutationFn: () => api(`/api/payroll/runs/${runId}/treasury`, { method: "DELETE" }),
    onSuccess: () => router.push(`/app/payroll/runs/${runId}`),
  })

  return (
    <ApprovalDetailView
      detail={detail.data}
      error={detail.isError && !detail.data}
      onRetry={() => void detail.refetch()}
      busy={vote.isPending || !signer.ready}
      problem={
        vote.error
          ? vote.error instanceof ApiError
            ? vote.error.message
            : vote.error instanceof Error
              ? vote.error.message
              : "That didn't go through"
          : null
      }
      onVote={(choice) => vote.mutate(choice)}
      onSendAgain={
        detail.data?.approvers.find((a) => a.owner)?.account === detail.data?.me
          ? () => sendAgain.mutate()
          : undefined
      }
    />
  )
}
