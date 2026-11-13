"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { DevelopersView } from "@/components/developers/developers-view"
import { ApiError, api } from "@/lib/client/api"
import type { DevelopersView as Data } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const POLL_MS = 3_000

export default function DevelopersPage() {
  const queryClient = useQueryClient()
  const [newKey, setNewKey] = useState<string | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)

  const data = useQuery({
    queryKey: ["developers"],
    queryFn: () => api<Data>("/api/developers"),
    // While a delivery is on its way, keep the log fresh.
    refetchInterval: (query) =>
      query.state.data?.deliveries.some((d) => d.status === "pending") ? POLL_MS : 15_000,
  })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["developers"] })
  const fail = (error: unknown) => {
    fire("fail", { cue: "error" })
    setProblem(error instanceof ApiError ? error.message : "That didn't work. Try again.")
  }
  const act = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onMutate: () => setProblem(null),
    onSuccess: () => {
      fire("tick", { cue: "confirmed" })
      refresh()
    },
    onError: fail,
  })

  return (
    <DevelopersView
      data={data.data}
      error={data.isError && !data.data}
      onRetry={() => void data.refetch()}
      busy={act.isPending}
      problem={problem}
      newKey={newKey}
      onCreateKey={(name) =>
        act.mutate(async () =>
          setNewKey((await api<{ key: string }>("/api/developers/keys", { body: { name } })).key),
        )
      }
      onCloseKey={() => setNewKey(null)}
      onRevokeKey={(id) =>
        act.mutate(() => api(`/api/developers/keys/${id}`, { method: "DELETE" }))
      }
      onAddEndpoint={(url) =>
        act.mutate(async () =>
          setNewSecret(
            (await api<{ secret: string }>("/api/developers/endpoints", { body: { url } })).secret,
          ),
        )
      }
      onAddInbox={() =>
        act.mutate(async () =>
          setNewSecret(
            (await api<{ secret: string }>("/api/developers/endpoints", { body: { inbox: true } }))
              .secret,
          ),
        )
      }
      onToggle={(id, enabled) =>
        act.mutate(() =>
          api(`/api/developers/endpoints/${id}`, { method: "PATCH", body: { enabled } }),
        )
      }
      onDelete={(id) =>
        act.mutate(() => api(`/api/developers/endpoints/${id}`, { method: "DELETE" }))
      }
      onTest={(id) =>
        act.mutate(() => api(`/api/developers/endpoints/${id}/test`, { method: "POST" }))
      }
      onReveal={(id) =>
        act.mutate(async () => {
          const { secret } = await api<{ secret: string }>(`/api/developers/endpoints/${id}/secret`)
          setRevealed((r) => ({ ...r, [id]: secret }))
        })
      }
      revealed={revealed}
      newSecret={newSecret}
      onCloseSecret={() => setNewSecret(null)}
      onResend={(id) =>
        act.mutate(() => api(`/api/developers/deliveries/${id}/resend`, { method: "POST" }))
      }
    />
  )
}
