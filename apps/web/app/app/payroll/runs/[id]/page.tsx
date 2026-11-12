"use client"

// A run: the review the owner approves, then the run as it lands. Before signing, every batch the server built is
// re-encoded here and checked against the rows on screen (who, which account, how much, which memo), so the key
// only ever signs what the owner reviewed.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { use, useState } from "react"

import { RunView } from "@/components/payroll/run-view"
import { useNearKey } from "@/hooks/use-near-key"
import { useProfile } from "@/hooks/use-profile"
import { ApiError, api } from "@/lib/client/api"
import type { PayRun, PayRunRow, RunBatchDraft } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const POLL_MS = 1_500

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const { profile } = useProfile()
  const key = useNearKey()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const run = useQuery({
    queryKey: ["run", id],
    queryFn: () => api<{ run: PayRun }>(`/api/payroll/runs/${id}`),
    select: (data) => data.run,
    refetchInterval: (query) => (query.state.data?.run.status === "approved" ? POLL_MS : false),
  })
  const account = profile?.accounts.find((entry) => entry.network === "testnet")
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["run", id] })
    void queryClient.invalidateQueries({ queryKey: ["payroll"] })
    void queryClient.invalidateQueries({ queryKey: ["me"] })
    void queryClient.invalidateQueries({ queryKey: ["activity"] })
  }

  const toggle = useMutation({
    mutationFn: ({ row, included }: { row: PayRunRow; included: boolean }) =>
      api(`/api/payroll/runs/${id}/rows/${row.id}`, { method: "PATCH", body: { included } }),
    onSettled: refresh,
  })

  async function pay() {
    const shown = run.data
    if (!shown) return
    setBusy(true)
    setProblem(null)
    try {
      const { batches } = await api<{ batches: RunBatchDraft[] }>(
        `/api/payroll/runs/${id}/prepare`,
        {
          method: "POST",
        },
      )
      const { draftMatchesHash } = await import("@tegata/core/near")
      const expected = new Map(
        shown.rows.filter((r) => r.status === "included").map((r) => [r.id, r] as const),
      )
      let covered = 0
      for (const batch of batches) {
        if (!draftMatchesHash(batch.draft) || batch.draft.calls.length !== batch.rows.length)
          throw new Error("The run to approve doesn't match what you reviewed")
        batch.draft.calls.forEach((call, i) => {
          const row = expected.get(batch.rows[i]?.id ?? "")
          const args = JSON.parse(call.argsJson) as {
            receiver_id?: string
            amount?: string
            memo?: string
          }
          if (
            !row ||
            call.method !== "ft_transfer" ||
            args.receiver_id !== row.accountId ||
            args.amount !== row.amount ||
            args.memo !== `tegata:payroll:${row.id}`
          )
            throw new Error("The run to approve doesn't match what you reviewed")
          covered++
        })
      }
      if (covered !== expected.size)
        throw new Error("The run to approve doesn't match what you reviewed")
      const signatures = []
      for (const batch of batches) {
        signatures.push({ relayId: batch.relayId, signature: await key.sign(batch.draft.hash) })
      }
      await api(`/api/payroll/runs/${id}/approve`, { body: { signatures } })
      fire("confirm", { cue: "sent" })
      refresh()
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(error instanceof Error ? error.message : "Couldn't approve the run")
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const retry = useMutation({
    mutationFn: () => api<{ runId: string }>("/api/payroll/runs", { method: "POST" }),
    onSuccess: refresh,
    onError: (error) =>
      setProblem(error instanceof ApiError ? error.message : "Couldn't redraft the run"),
  })

  return (
    <RunView
      run={run.data}
      error={run.isError && !run.data}
      onReload={() => void run.refetch()}
      business={profile?.workspace?.name ?? "Your business"}
      balance={account?.balance ?? null}
      busy={busy || !key.ready || retry.isPending}
      problem={problem}
      onToggle={(row, included) => toggle.mutate({ row, included })}
      onPay={pay}
      onRetry={() => retry.mutate()}
    />
  )
}
