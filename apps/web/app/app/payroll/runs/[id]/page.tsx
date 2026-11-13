"use client"

// A run: the review the owner approves, then the run as it lands. Before signing, every batch the server built is
// re-encoded here and checked against the rows on screen (who, which account, how much, which memo), so the key
// only ever signs what the owner reviewed.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { use, useEffect, useState } from "react"

import { type RowPayInput, RowPaySheet } from "@/components/payroll/row-pay-sheet"
import { RunView } from "@/components/payroll/run-view"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { useSigner } from "@/hooks/use-signer"
import { ApiError, api } from "@/lib/client/api"
import { proposeDraftMatches } from "@/lib/client/treasury-check"
import type { PayRun, PayRunRow, RunBatchDraft } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const POLL_MS = 1_500

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const { profile } = useProfile()
  const signer = useSigner()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const run = useQuery({
    queryKey: ["run", id],
    queryFn: () => api<{ run: PayRun }>(`/api/payroll/runs/${id}`),
    select: (data) => data.run,
    refetchInterval: (query) => (query.state.data?.run.status === "approved" ? POLL_MS : false),
  })
  const network = useNetwork()
  const account = profile?.accounts.find((entry) => entry.network === network)
  const router = useRouter()
  // A team treasury that's ready pays payroll after its approvers vote: the hold sends the run for approval.
  const team = useQuery({
    queryKey: ["team", network],
    queryFn: () =>
      api<{
        treasury: {
          accountId: string
          status: string
          balance: string
          threshold: number
          approvers: string[]
        } | null
      }>("/api/team"),
    staleTime: 30_000,
  })
  const treasury = team.data?.treasury?.status === "ready" ? team.data.treasury : null
  // Sent to the treasury: its approvals page follows the votes and the payment.
  useEffect(() => {
    if (run.data?.source === "treasury" && run.data.status !== "draft")
      router.replace(`/app/approvals/${id}`)
  }, [run.data?.source, run.data?.status, id, router])
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["run", id] })
    void queryClient.invalidateQueries({ queryKey: ["payroll"] })
    void queryClient.invalidateQueries({ queryKey: ["me"] })
    void queryClient.invalidateQueries({ queryKey: ["activity"] })
  }

  const [editing, setEditing] = useState<PayRunRow | null>(null)
  const savePay = useMutation({
    mutationFn: ({ row, input }: { row: PayRunRow; input: RowPayInput }) =>
      api(`/api/payroll/runs/${id}/rows/${row.id}`, { method: "PUT", body: input }),
    onSuccess: () => {
      fire("tick", { cue: "confirmed" })
      setEditing(null)
      refresh()
    },
    onError: () => fire("fail", { cue: "error" }),
  })
  const toggle = useMutation({
    mutationFn: ({ row, included }: { row: PayRunRow; included: boolean }) =>
      api(`/api/payroll/runs/${id}/rows/${row.id}`, { method: "PATCH", body: { included } }),
    onSettled: refresh,
  })

  async function sendForApproval() {
    const shown = run.data
    if (!shown || !treasury) return
    setBusy(true)
    setProblem(null)
    try {
      const prepared = await api<{
        relayId: string
        draft: RunBatchDraft["draft"]
        proposalId: number
        usdc: string
      }>(`/api/payroll/runs/${id}/treasury`, { method: "POST" })
      const { draftMatchesHash } = await import("@tegata/core/near")
      const onScreen = shown.rows.filter((r) => r.status === "included")
      if (
        !draftMatchesHash(prepared.draft) ||
        !proposeDraftMatches(
          prepared.draft,
          treasury.accountId,
          prepared.usdc,
          prepared.proposalId,
          onScreen,
        )
      )
        throw new Error("The payroll to send doesn't match what you reviewed")
      const [approval] = await signer.approve([prepared])
      if (!approval) throw new Error("Nothing was signed")
      await api(`/api/payroll/runs/${id}/treasury`, {
        method: "PUT",
        body: { proposalId: prepared.proposalId, approval },
      })
      fire("confirm", { cue: "sent" })
      refresh()
      router.push(`/app/approvals/${id}`)
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(error instanceof Error ? error.message : "Couldn't send the run for approval")
      refresh()
    } finally {
      setBusy(false)
    }
  }

  async function pay() {
    const shown = run.data
    if (!shown) return
    if (treasury) return sendForApproval()
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
      const { maxConversionExtra } = await import("@tegata/config")
      const expected = new Map(
        shown.rows.filter((r) => r.status === "included").map((r) => [r.id, r] as const),
      )
      let covered = 0
      for (const batch of batches) {
        if (!draftMatchesHash(batch.draft) || batch.draft.calls.length !== batch.rows.length)
          throw new Error("The run to approve doesn't match what you reviewed")
        batch.draft.calls.forEach((call, i) => {
          const planned = batch.rows[i]
          const row = expected.get(planned?.id ?? "")
          const args = JSON.parse(call.argsJson) as {
            receiver_id?: string
            amount?: string
            memo?: string
          }
          // A row on NEAR goes to the account reviewed, with its memo. A row for another chain goes to its NEAR
          // Intents deposit address, and the quote behind it must deliver to the address and coin reviewed.
          const chain = row?.destinationKind === "chain"
          const right = chain
            ? planned?.via?.recipient === row.accountId &&
              planned?.via?.route === row.route &&
              args.receiver_id === planned?.accountId &&
              /^[0-9a-f]{64}$/.test(args.receiver_id ?? "") &&
              args.memo === undefined
            : args.receiver_id === row?.accountId && args.memo === `tegata:payroll:${row?.id}`
          // A stablecoin on another chain arrives as exactly the pay, so its transfer may carry NEAR Intents'
          // conversion on top, within the cap; every other row sends exactly the pay reviewed.
          const sent = BigInt(args.amount ?? "0")
          const pay = BigInt(row?.amount ?? "0")
          const amountRight = chain
            ? args.amount === planned?.amount &&
              sent >= pay &&
              sent - pay <= maxConversionExtra(pay)
            : args.amount === row?.amount
          if (!row || call.method !== "ft_transfer" || !amountRight || !right)
            throw new Error("The run to approve doesn't match what you reviewed")
          covered++
        })
      }
      if (covered !== expected.size)
        throw new Error("The run to approve doesn't match what you reviewed")
      const signatures = await signer.approve(batches)
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
    <>
      <RunView
        run={run.data}
        error={run.isError && !run.data}
        onReload={() => void run.refetch()}
        business={profile?.workspace?.name ?? "Your business"}
        balance={treasury ? treasury.balance : (account?.balance ?? null)}
        busy={busy || !signer.ready || retry.isPending}
        problem={problem}
        onToggle={(row, included) => toggle.mutate({ row, included })}
        onEdit={(row) => {
          savePay.reset()
          setEditing(row)
        }}
        onPay={pay}
        onRetry={() => retry.mutate()}
        payLabel={
          treasury && run.data
            ? `Hold to send for approval · ${run.data.rows.filter((r) => r.status === "included").length} people`
            : undefined
        }
        payNote={
          treasury
            ? `From the team treasury: it pays once ${treasury.threshold} of ${treasury.approvers.length} approve, yours included.`
            : undefined
        }
      />
      <RowPaySheet
        row={editing}
        period={run.data?.label ?? ""}
        busy={savePay.isPending}
        problem={
          savePay.error
            ? savePay.error instanceof ApiError
              ? savePay.error.message
              : "That didn't save. Try again."
            : null
        }
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={(row, input) => savePay.mutate({ row, input })}
      />
    </>
  )
}
