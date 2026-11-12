"use client"

// One pay link: the logic behind LinkDetailView. It refreshes every few seconds so a payment appears while the
// business watches, and the "received" cue plays once for each payment that lands here.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"

import { LinkDetailView } from "@/components/links/link-detail-view"
import { useProfile } from "@/hooks/use-profile"
import { api } from "@/lib/client/api"
import type { LinkDetail, PayLink } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const POLL_MS = 4_000

export default function LinkPage() {
  return (
    <Suspense>
      <LinkDetailPage />
    </Suspense>
  )
}

function LinkDetailPage() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const { profile } = useProfile()
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => setOrigin(window.location.origin), [])

  const detail = useQuery({
    queryKey: ["link", id],
    queryFn: () => api<LinkDetail>(`/api/links/${id}`),
    refetchInterval: POLL_MS,
  })

  // Money arriving while the page is open: one cue per payment, never for the ones already here on load.
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    const paid = (detail.data?.payments ?? []).filter((p) => p.status === "succeeded")
    if (!detail.data) return
    if (seen.current === null) {
      seen.current = new Set(paid.map((p) => p.id))
      return
    }
    for (const payment of paid) {
      if (seen.current.has(payment.id)) continue
      seen.current.add(payment.id)
      fire("filled", { cue: "received", identity: payment.id })
      void queryClient.invalidateQueries({ queryKey: ["me"] })
      void queryClient.invalidateQueries({ queryKey: ["links"] })
    }
  }, [detail.data, queryClient])

  const toggle = useMutation({
    mutationFn: (open: boolean) =>
      api<{ link: PayLink }>(`/api/links/${id}`, { method: "PATCH", body: { open } }),
    onSuccess: ({ link }) => {
      queryClient.setQueryData<LinkDetail>(["link", id], (old) =>
        old ? { ...old, request: link } : old,
      )
      void queryClient.invalidateQueries({ queryKey: ["links"] })
    },
    onError: () => fire("fail", { cue: "error" }),
  })

  const token = detail.data?.request.token
  return (
    <LinkDetailView
      detail={detail.data}
      error={detail.isError && !detail.data}
      businessName={profile?.workspace?.name ?? "Your business"}
      url={origin && token ? `${origin}/pay/${token}` : null}
      fresh={params.get("new") === "1"}
      toggling={toggle.isPending}
      onToggle={(open) => toggle.mutate(open)}
      onRetry={() => void detail.refetch()}
    />
  )
}
