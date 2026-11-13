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
import { retryDraftMatches, voteDraftMatches } from "@/lib/client/treasury-check"
import { fire } from "@/lib/feedback"

const POLL_MS = 3_000
/** A failed run reads NEAR for its retry window, so it is polled more gently. */
const FAILED_POLL_MS = 10_000

export default function ApprovalPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params)
  const router = useRouter()
  const signer = useSigner()
  const queryClient = useQueryClient()
  const detail = useQuery({
    queryKey: ["approval", runId],
    queryFn: () => api<ApprovalDetail>(`/api/approvals/${runId}`),
    // A failed run is polled too: a retry (here or in Trezu) can still pay it inside its voting period.
    refetchInterval: (query) =>
      query.state.data?.status === "proposed" || query.state.data?.status === "approved"
        ? POLL_MS
        : query.state.data?.status === "failed"
          ? FAILED_POLL_MS
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
    onError: () => fire("fail", { cue: "error" }),
  })

  // Try again: finalize the same failed proposal. The browser checks it is exactly that, on this treasury, first.
  const tryAgain = useMutation({
    mutationFn: async () => {
      const shown = detail.data
      if (!shown || shown.proposalId === null) throw new Error("Nothing to try again")
      const prepared = await api<{ relayId: string; draft: DelegateDraft; usdc: string }>(
        `/api/payroll/runs/${runId}/treasury/retry`,
        { method: "POST" },
      )
      const { draftMatchesHash } = await import("@tegata/core/near")
      const onScreen = shown.rows.filter((row) => row.status === "included")
      if (
        !draftMatchesHash(prepared.draft) ||
        !retryDraftMatches(
          prepared.draft,
          shown.treasury,
          prepared.usdc,
          shown.proposalId,
          onScreen,
        )
      )
        throw new Error("The retry to sign doesn't match this payroll")
      const [approval] = await signer.approve([prepared])
      if (!approval) throw new Error("Nothing was signed")
      await api(`/api/payroll/runs/${runId}/treasury/retry`, { method: "PUT", body: { approval } })
    },
    onSuccess: () => {
      fire("confirm", { cue: "sent" })
      void queryClient.invalidateQueries({ queryKey: ["approval", runId] })
    },
    onError: () => fire("fail", { cue: "error" }),
  })

  const failure = vote.error ?? tryAgain.error ?? sendAgain.error
  const owner = detail.data?.approvers.find((a) => a.owner)?.account === detail.data?.me

  return (
    <ApprovalDetailView
      detail={detail.data}
      error={detail.isError && !detail.data}
      onRetry={() => void detail.refetch()}
      busy={vote.isPending || tryAgain.isPending || sendAgain.isPending || !signer.ready}
      problem={
        failure
          ? failure instanceof ApiError || failure instanceof Error
            ? failure.message
            : "That didn't go through"
          : null
      }
      onVote={(choice) => vote.mutate(choice)}
      onSendAgain={owner ? () => sendAgain.mutate() : undefined}
      onTryAgain={owner ? () => tryAgain.mutate() : undefined}
      retrying={tryAgain.isSuccess && detail.data?.status === "failed"}
    />
  )
}
