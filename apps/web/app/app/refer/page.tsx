"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { ReferView } from "@/components/referrals/refer-view"
import { useProfile } from "@/hooks/use-profile"
import { ApiError, api } from "@/lib/client/api"
import type { ReferralsView } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const POLL_MS = 30_000

export default function ReferPage() {
  const { profile } = useProfile()
  const queryClient = useQueryClient()
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => setOrigin(window.location.origin), [])

  const data = useQuery({
    queryKey: ["referrals"],
    queryFn: () => api<ReferralsView>("/api/referrals"),
    refetchInterval: POLL_MS,
  })
  const referrer = useMutation({
    mutationFn: (handle: string | null) =>
      handle
        ? api("/api/referrals/referrer", {
            method: "PUT",
            body: { handle: handle.replace(/\.tegata\.(near|testnet)$/, "") },
          })
        : api("/api/referrals/referrer", { method: "DELETE" }),
    onSuccess: () => {
      fire("tick", { cue: "confirmed" })
      void queryClient.invalidateQueries({ queryKey: ["referrals"] })
    },
    onError: () => fire("fail", { cue: "error" }),
  })

  const handle = data.data?.handle
  return (
    <ReferView
      data={data.data}
      error={data.isError && !data.data}
      onRetry={() => void data.refetch()}
      url={origin && handle ? `${origin}/join/${handle}` : null}
      businessName={profile?.workspace?.name ?? "Your business"}
      saving={referrer.isPending}
      problem={
        referrer.error
          ? referrer.error instanceof ApiError
            ? referrer.error.message
            : "Couldn't save that"
          : null
      }
      onSetReferrer={(h) => referrer.mutate(h)}
      onRemoveReferrer={() => referrer.mutate(null)}
    />
  )
}
