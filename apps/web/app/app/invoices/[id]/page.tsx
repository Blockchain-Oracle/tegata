"use client"

// One invoice: the logic behind InvoiceDetailView. It refreshes while open, so a payment appears with the seal and
// the "received" cue the moment NEAR settles it.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { localToday } from "@tegata/core/invoices"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"

import { InvoiceDetailView } from "@/components/invoices/invoice-detail-view"
import { useProfile } from "@/hooks/use-profile"
import { ApiError, api } from "@/lib/client/api"
import type { InvoiceDetail } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const POLL_MS = 5_000

export default function InvoicePage() {
  return (
    <Suspense>
      <Invoice />
    </Suspense>
  )
}

function Invoice() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { profile } = useProfile()
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => setOrigin(window.location.origin), [])

  const detail = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api<InvoiceDetail>(`/api/invoices/${id}`),
    refetchInterval: (query) => (query.state.data?.invoice.status === "open" ? POLL_MS : false),
  })

  // A draft is edited, not viewed.
  useEffect(() => {
    if (detail.data?.draft) router.replace(`/app/invoices/${id}/edit`)
  }, [detail.data?.draft, id, router])

  // Money arriving while the page is open: one cue per payment; the seal presses when it becomes paid.
  const seen = useRef<Set<string> | null>(null)
  const wasOpen = useRef<boolean | null>(null)
  const [pressSeal, setPressSeal] = useState(false)
  useEffect(() => {
    const data = detail.data
    if (!data) return
    const paid = data.payments.filter((p) => p.status === "succeeded")
    if (seen.current === null) seen.current = new Set(paid.map((p) => p.id))
    for (const payment of paid) {
      if (seen.current.has(payment.id)) continue
      seen.current.add(payment.id)
      fire("filled", { cue: "received", identity: payment.id })
    }
    if (wasOpen.current === true && data.invoice.status === "paid") setPressSeal(true)
    wasOpen.current = data.invoice.status === "open"
  }, [detail.data])

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["invoice", id] })
    void queryClient.invalidateQueries({ queryKey: ["invoices"] })
  }
  const act = useMutation({
    mutationFn: async (
      action:
        | { kind: "void" }
        | { kind: "duplicate" }
        | { kind: "paid"; amount: string; note: string },
    ) => {
      if (action.kind === "void") return api(`/api/invoices/${id}/void`, { method: "POST" })
      if (action.kind === "duplicate")
        return api<{ invoice: { id: string } }>(`/api/invoices/${id}/duplicate`, { method: "POST" })
      return api(`/api/invoices/${id}/paid`, {
        body: { amount: action.amount, note: action.note || null },
      })
    },
    onSuccess: (result, action) => {
      refresh()
      if (action.kind === "duplicate") {
        fire("tick", { cue: "confirmed" })
        router.push(`/app/invoices/${(result as { invoice: { id: string } }).invoice.id}/edit`)
      } else fire("tick", { cue: action.kind === "paid" ? "received" : "confirmed" })
    },
    onError: () => fire("fail", { cue: "error" }),
  })

  const token = detail.data?.token
  return (
    <InvoiceDetailView
      detail={detail.data}
      error={detail.isError && !detail.data}
      onRetry={() => void detail.refetch()}
      logo={profile?.workspace?.logo ?? null}
      today={localToday(profile?.workspace?.timezone ?? "UTC")}
      url={origin && token ? `${origin}/i/${token}` : null}
      justSent={params.get("sent") === "1"}
      pressSeal={pressSeal}
      busy={act.isPending ? (act.variables?.kind ?? null) : null}
      problem={
        act.error
          ? act.error instanceof ApiError
            ? act.error.message
            : "That didn't work. Try again."
          : null
      }
      onVoid={() => act.mutate({ kind: "void" })}
      onMarkPaid={(amount, note) => act.mutate({ kind: "paid", amount, note })}
      onDuplicate={() => act.mutate({ kind: "duplicate" })}
    />
  )
}
