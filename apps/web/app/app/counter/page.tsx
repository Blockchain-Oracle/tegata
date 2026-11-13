"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { type CounterSale, CounterView } from "@/components/counter/counter-view"
import { useProfile } from "@/hooks/use-profile"
import { ApiError, api } from "@/lib/client/api"
import type { PublicRequest } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const POLL_MS = 1_500

export default function CounterPage() {
  const queryClient = useQueryClient()
  const { profile } = useProfile()
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [sale, setSale] = useState<{
    id: string
    token: string
    url: string
    amount: string
  } | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const sales = useQuery({
    queryKey: ["counter"],
    queryFn: () => api<{ sales: CounterSale[] }>("/api/counter"),
    select: (data) => data.sales,
  })
  const status = useQuery({
    queryKey: ["counter-sale", sale?.token],
    queryFn: () => api<PublicRequest>(`/api/pay/${sale?.token}`),
    enabled: Boolean(sale),
    refetchInterval: (query) => (query.state.data?.status === "paid" ? false : POLL_MS),
  })
  const paid = status.data?.status === "paid"

  async function charge() {
    setBusy(true)
    setProblem(null)
    try {
      const made = await api<{ id: string; token: string; url: string; amount: string }>(
        "/api/counter",
        {
          body: { amount, note },
        },
      )
      fire("tick", { cue: "sheetOpen" })
      setSale(made)
      setStartedAt(Date.now())
      void queryClient.invalidateQueries({ queryKey: ["counter"] })
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(error instanceof ApiError ? error.message : "Couldn't start the sale")
    } finally {
      setBusy(false)
    }
  }

  return (
    <CounterView
      business={profile?.workspace?.name ?? "Your business"}
      amount={amount}
      onAmount={setAmount}
      note={note}
      onNote={setNote}
      sale={sale}
      paid={paid}
      startedAt={startedAt}
      busy={busy}
      problem={problem}
      onCharge={() => void charge()}
      onNew={() => {
        // Cancelling an unpaid sale closes it, so its QR can't be paid later; "New sale" after a payment just clears.
        if (sale && !paid) void api(`/api/counter/${sale.id}`, { method: "DELETE" })
        setSale(null)
        setAmount("")
        setNote("")
        void queryClient.invalidateQueries({ queryKey: ["counter"] })
      }}
      sales={sales.data}
    />
  )
}
