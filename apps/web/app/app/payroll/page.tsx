"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { localToday } from "@tegata/core/invoices"
import { useRouter } from "next/navigation"

import { PayrollView } from "@/components/payroll/payroll-view"
import { ApiError, api } from "@/lib/client/api"
import type { PayCadence, PayrollOverview, TeamPerson } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const message = (error: unknown, fallback: string) =>
  error ? (error instanceof ApiError ? error.message : fallback) : null

export default function PayrollPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const overview = useQuery({
    queryKey: ["payroll"],
    queryFn: () => api<PayrollOverview>("/api/payroll"),
  })
  const team = useQuery({
    queryKey: ["people"],
    queryFn: () => api<{ people: TeamPerson[]; emailEnabled: boolean }>("/api/people"),
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

  return (
    <PayrollView
      overview={overview.data}
      people={team.data?.people}
      error={(overview.isError && !overview.data) || (team.isError && !team.data)}
      onRetry={() => {
        void overview.refetch()
        void team.refetch()
      }}
      today={localToday(timezone)}
      savingSchedule={schedule.isPending}
      scheduleProblem={message(schedule.error, "Couldn't save the schedule. Try again.")}
      onSaveSchedule={(cadence, nextPayday) => schedule.mutate({ cadence, nextPayday })}
      starting={start.isPending}
      startProblem={message(start.error, "Couldn't start the run. Try again.")}
      onRun={() => start.mutate()}
    />
  )
}
