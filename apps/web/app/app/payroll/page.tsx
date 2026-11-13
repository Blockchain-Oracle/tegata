"use client"

// Payroll: the schedule, the next payday and the team, past runs, and the autopilot. Turning autopilot on is: snapshot
// (server) → Tegata registers the business on the contract (worker) → the owner signs two actions together, each
// re-encoded and checked here against what the sheet showed → the worker relays them in order → the plan is on.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { NETWORKS } from "@tegata/config"
import { localToday } from "@tegata/core/invoices"
import type { DelegateDraft } from "@tegata/core/near"
import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  type AutopilotAction,
  AutopilotCard,
  AutopilotSheet,
} from "@/components/payroll/autopilot-card"
import { PayrollView } from "@/components/payroll/payroll-view"
import { useProfile } from "@/hooks/use-profile"
import { useSigner } from "@/hooks/use-signer"
import { ApiError, api } from "@/lib/client/api"
import { checkDraft, signAndFollow } from "@/lib/client/sign-relay"
import type {
  AutopilotPreview,
  AutopilotView,
  PayCadence,
  PayrollOverview,
  TeamPerson,
} from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const NETWORK = "testnet" as const
const POLL_MS = 2_000
const SETUP_POLLS = 90
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const message = (error: unknown, fallback: string) =>
  error ? (error instanceof ApiError || error instanceof Error ? error.message : fallback) : null

type Relay = { relayId: string; draft: DelegateDraft }

export default function PayrollPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { profile } = useProfile()
  const signer = useSigner()
  const [sheet, setSheet] = useState(false)
  const [count, setCount] = useState(3)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const overview = useQuery({
    queryKey: ["payroll"],
    queryFn: () => api<PayrollOverview>("/api/payroll"),
  })
  const team = useQuery({
    queryKey: ["people"],
    queryFn: () => api<{ people: TeamPerson[]; emailEnabled: boolean }>("/api/people"),
  })
  const autopilot = useQuery({
    queryKey: ["autopilot"],
    queryFn: () => api<{ autopilot: AutopilotView }>("/api/autopilot"),
    select: (data) => data.autopilot,
    refetchInterval: (query) => {
      const status = query.state.data?.autopilot.row?.status
      return status && status !== "on" && status !== "failed" ? POLL_MS : 30_000
    },
  })
  const preview = useQuery({
    queryKey: ["autopilot-preview", count],
    queryFn: () => api<AutopilotPreview>(`/api/autopilot/preview?count=${count}`),
    enabled: sheet,
  })
  const schedule = useMutation({
    mutationFn: (input: { cadence: PayCadence; nextPayday: string }) =>
      api("/api/payroll", { method: "PUT", body: input }),
    onSuccess: () => {
      fire("tick", { cue: "confirmed" })
      void queryClient.invalidateQueries({ queryKey: ["payroll"] })
    },
    onError: () => fire("fail", { cue: "error" }),
  })
  const start = useMutation({
    mutationFn: () => api<{ runId: string }>("/api/payroll/runs", { method: "POST" }),
    onSuccess: ({ runId }) => router.push(`/app/payroll/runs/${runId}`),
    onError: () => fire("fail", { cue: "error" }),
  })

  const timezone = overview.data?.timezone ?? "UTC"
  const account = profile?.accounts.find((entry) => entry.network === NETWORK)
  const view = autopilot.data
  const net = NETWORKS[NETWORK]
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["autopilot"] })
    void queryClient.invalidateQueries({ queryKey: ["payroll"] })
    void queryClient.invalidateQueries({ queryKey: ["me"] })
  }

  async function turnOn(setAside: string) {
    const shown = preview.data
    if (!shown) return
    setBusy(true)
    setProblem(null)
    try {
      const { id } = await api<{ id: string }>("/api/autopilot", { body: { count, setAside } })
      setSheet(false)
      refresh()
      // Tegata registers the business on the contract first (it pays the storage).
      let ready = false
      for (let i = 0; i < SETUP_POLLS && !ready; i++) {
        const state = await api<{ autopilot: AutopilotView }>("/api/autopilot")
        const status = state.autopilot.row?.status
        if (status === "failed")
          throw new Error(state.autopilot.row?.error ?? "Couldn't get autopilot ready")
        ready = status === "ready"
        if (!ready) await sleep(POLL_MS)
      }
      if (!ready)
        throw new Error(
          "Autopilot is taking longer than usual. It carries on; check back in a minute.",
        )
      const drafts = await api<{ deposit: Relay; plan: Relay }>(`/api/autopilot/${id}/drafts`, {
        method: "POST",
      })
      const amount = (
        BigInt(Math.round(Number.parseFloat(setAside.replaceAll(",", "")) * 100)) * 10_000n
      ).toString()
      await checkDraft(drafts.deposit.draft, {
        receiverId: net.usdc,
        method: "ft_transfer_call",
        args: { receiver_id: net.autopilot, amount, msg: "" },
      })
      await checkDraft(drafts.plan.draft, {
        receiverId: net.autopilot,
        method: "create_plan",
        args: {
          rows: shown.rows.map((r) => ({ account_id: r.accountId, amount: r.amount })),
          due: shown.dueMs.map(String),
        },
      })
      // Signed together, in this order: setting the money aside, then the plan.
      const signatures = await signer.approve([drafts.deposit, drafts.plan])
      await api(`/api/autopilot/${id}/approve`, { body: { signatures } })
      fire("confirm", { cue: "confirmed" })
      refresh()
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(message(error, "Couldn't turn autopilot on"))
      refresh()
    } finally {
      setBusy(false)
    }
  }

  async function act(action: AutopilotAction, amount?: string) {
    const row = view?.row
    if (!row && action !== "withdraw") return
    setBusy(true)
    setProblem(null)
    try {
      const id = row?.id ?? view?.lastId
      if (!id) throw new Error("Set autopilot up to manage its money")
      const relay = await api<Relay>(`/api/autopilot/${id}/action`, { body: { action, amount } })
      const units = amount
        ? (
            BigInt(Math.round(Number.parseFloat(amount.replaceAll(",", "")) * 100)) * 10_000n
          ).toString()
        : undefined
      const expected =
        action === "add"
          ? {
              receiverId: net.usdc,
              method: "ft_transfer_call",
              args: { receiver_id: net.autopilot, amount: units, msg: "" },
            }
          : action === "withdraw"
            ? { receiverId: net.autopilot, method: "withdraw", args: { amount: units } }
            : {
                receiverId: net.autopilot,
                method:
                  action === "pause"
                    ? "pause_plan"
                    : action === "resume"
                      ? "resume_plan"
                      : "cancel_plan",
                args: { plan_id: row?.planId },
              }
      await signAndFollow(signer.approve, relay, expected)
      fire("confirm", { cue: action === "add" || action === "withdraw" ? "sent" : "confirmed" })
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(message(error, "That didn't go through"))
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const people = team.data?.people
  const nextPayday = overview.data?.schedule?.nextPayday
  const autopilotPays = Boolean(
    view?.row &&
      ["approved", "on"].includes(view.row.status) &&
      nextPayday &&
      view.row.paydays.includes(nextPayday),
  )

  return (
    <>
      <PayrollView
        overview={overview.data}
        people={people}
        error={(overview.isError && !overview.data) || (team.isError && !team.data)}
        onRetry={() => {
          void overview.refetch()
          void team.refetch()
        }}
        today={localToday(timezone)}
        savingSchedule={schedule.isPending}
        scheduleProblem={message(schedule.error, "Couldn't save the schedule. Try again.")}
        onSaveSchedule={(cadence, payday) => schedule.mutate({ cadence, nextPayday: payday })}
        starting={start.isPending}
        startProblem={message(start.error, "Couldn't start the run. Try again.")}
        onRun={() => start.mutate()}
        autopilotPays={autopilotPays}
        autopilot={
          <AutopilotCard
            view={view}
            canSetUp={Boolean(
              overview.data?.schedule && people?.some((p) => p.ready.state === "ready"),
            )}
            busy={busy || !signer.ready}
            problem={problem}
            onSetUp={() => {
              setProblem(null)
              setSheet(true)
            }}
            onAction={(action, amount) => void act(action, amount)}
          />
        }
      />
      <AutopilotSheet
        open={sheet}
        onOpenChange={setSheet}
        preview={preview.data}
        count={count}
        onCount={setCount}
        balance={account?.balance ?? null}
        busy={busy}
        problem={message(preview.error, "Couldn't load the paydays") ?? problem}
        onTurnOn={(setAside) => void turnOn(setAside)}
      />
    </>
  )
}
