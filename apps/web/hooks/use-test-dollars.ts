"use client"

// Sandbox test dollars: ask once a day, follow the operator's transfer to NEAR, then refresh the balance. Shared by
// Home's tile and the pay page, so a judge with no wallet can pay a link.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { ApiError, api } from "@/lib/client/api"
import { fire } from "@/lib/feedback"

const POLL_MS = 1_500

interface Grant {
  id: string
  status: "queued" | "sent" | "failed"
  amount: string
  error: string | null
  explorerUrl: string | null
}

export type TestDollarsState = "idle" | "sending" | "sent" | "failed"

export interface TestDollars {
  state: TestDollarsState
  error: string | null
  explorerUrl: string | null
}

export function useTestDollars(): TestDollars & { add: () => void } {
  const queryClient = useQueryClient()
  const [grantId, setGrantId] = useState<string | null>(null)

  const ask = useMutation({
    mutationFn: () => api<Grant>("/api/test-dollars", { method: "POST" }),
    onSuccess: (grant) => setGrantId(grant.id),
    onError: () => fire("fail", { cue: "error" }),
  })

  const grant = useQuery({
    queryKey: ["test-dollars", grantId],
    queryFn: () => api<Grant>(`/api/test-dollars/${grantId}`),
    enabled: Boolean(grantId),
    refetchInterval: (query) =>
      query.state.data && query.state.data.status !== "queued" ? false : POLL_MS,
  })

  const status = grant.data?.status
  useEffect(() => {
    if (status === "sent") {
      fire("filled", { cue: "received", identity: `test-dollars:${grantId}` })
      void queryClient.invalidateQueries({ queryKey: ["me"] })
    } else if (status === "failed") fire("fail", { cue: "error" })
  }, [status, grantId, queryClient])

  const state: TestDollarsState =
    status === "sent"
      ? "sent"
      : status === "failed" || ask.isError
        ? "failed"
        : ask.isPending || grantId
          ? "sending"
          : "idle"
  const error =
    grant.data?.error ??
    (ask.error instanceof ApiError
      ? ask.error.message
      : ask.error
        ? "Couldn't ask for test dollars. Try again."
        : null)

  return {
    state,
    error,
    explorerUrl: grant.data?.explorerUrl ?? null,
    add: () => {
      setGrantId(null)
      ask.mutate()
    },
  }
}
