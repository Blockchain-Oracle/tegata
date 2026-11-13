"use client"

// Activity: a month of every movement. Refunds are signed here: the draft is checked against the sheet (to the payer,
// the amount, the refund memo) before the key signs it, then followed to NEAR.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { NETWORKS } from "@tegata/config"
import type { DelegateDraft } from "@tegata/core/near"
import { useState } from "react"

import { type ActivityFilter, ActivityView } from "@/components/books/activity-view"
import { type RefundDone, RefundSheet } from "@/components/books/refund-sheet"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { useSigner } from "@/hooks/use-signer"
import { ApiError, api, download } from "@/lib/client/api"
import { signAndFollow } from "@/lib/client/sign-relay"
import type { BooksMonth, MovementView, PayoutView } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const shift = (month: string, by: number) => {
  const [year, m] = month.split("-").map(Number) as [number, number]
  const at = new Date(Date.UTC(year, m - 1 + by, 1))
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`
}

export default function ActivityPage() {
  const queryClient = useQueryClient()
  const signer = useSigner()
  const network = useNetwork()
  const { profile } = useProfile()
  const [month, setMonth] = useState<string | null>(null)
  const [filter, setFilter] = useState<ActivityFilter>("all")
  const [query, setQuery] = useState("")
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null)
  const [refunding, setRefunding] = useState<MovementView | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<RefundDone | null>(null)

  const books = useQuery({
    queryKey: ["books", month],
    queryFn: () => api<BooksMonth>(month ? `/api/books?month=${month}` : "/api/books"),
    refetchInterval: 15_000,
  })
  const current = books.data?.month ?? month
  const [thisMonth] = useState(() => new Date().toISOString().slice(0, 7))

  async function exportFile(kind: "csv" | "pdf") {
    if (!current) return
    setExporting(kind)
    try {
      await download(`/api/books/${current}.${kind}`)
      fire("tick", { cue: "confirmed" })
    } catch {
      fire("fail", { cue: "error" })
    } finally {
      setExporting(null)
    }
  }

  async function refund(amount: string) {
    const m = refunding
    if (!m?.refundable) return
    setBusy(true)
    setProblem(null)
    try {
      const relay = await api<{
        relayId: string
        draft: DelegateDraft
        /** Paid from another chain: the refund goes to this NEAR Intents deposit address. */
        depositAddress?: string
        payout?: PayoutView
      }>(`/api/payments/${m.refundable.paymentId}/refund`, { body: { amount } })
      const units = (
        BigInt(Math.round(Number.parseFloat(amount.replaceAll(",", "")) * 100)) * 10_000n
      ).toString()
      // Exactly this many USDC: to the payer's NEAR account with the refund memo, or (another chain) to the deposit
      // address NEAR Intents quoted for the payer's own address, with no memo.
      const status = await signAndFollow(signer.approve, relay, {
        receiverId: NETWORKS[network].usdc,
        method: "ft_transfer",
        args: relay.depositAddress
          ? { receiver_id: relay.depositAddress, amount: units, memo: undefined }
          : {
              receiver_id: m.refundable.payer,
              amount: units,
              memo: `tegata:refund:${m.refundable.paymentId}`,
            },
      })
      setDone({
        relayId: relay.relayId,
        explorerUrl: status.explorerUrl,
        payout: relay.payout ?? null,
      })
      fire("confirm", { cue: "sent" })
      void queryClient.invalidateQueries({ queryKey: ["books"] })
      void queryClient.invalidateQueries({ queryKey: ["me"] })
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(
        error instanceof ApiError || error instanceof Error ? error.message : "Couldn't refund",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ActivityView
        data={books.data}
        businessName={profile?.workspace?.name}
        error={books.isError && !books.data}
        onRetry={() => void books.refetch()}
        onPrev={() => current && setMonth(shift(current, -1))}
        onNext={() => current && setMonth(shift(current, 1))}
        canNext={Boolean(current && current < thisMonth)}
        filter={filter}
        onFilter={setFilter}
        query={query}
        onQuery={setQuery}
        exporting={exporting}
        onExport={(kind) => void exportFile(kind)}
        onRefund={(m) => {
          setProblem(null)
          setDone(null)
          setRefunding(m)
        }}
      />
      <RefundSheet
        movement={refunding}
        onOpenChange={(open) => !open && setRefunding(null)}
        busy={busy || !signer.ready}
        problem={problem}
        done={done}
        onRefund={(amount) => void refund(amount)}
      />
    </>
  )
}
