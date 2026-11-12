"use client"

import { useQuery } from "@tanstack/react-query"
import { localToday } from "@tegata/core/invoices"

import { InvoicesView } from "@/components/invoices/invoices-view"
import { useProfile } from "@/hooks/use-profile"
import { api } from "@/lib/client/api"
import type { InvoiceRow } from "@/lib/client/types"

const POLL_MS = 15_000

export default function InvoicesPage() {
  const { profile } = useProfile()
  const invoices = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api<{ invoices: InvoiceRow[] }>("/api/invoices"),
    select: (data) => data.invoices,
    refetchInterval: POLL_MS,
  })
  return (
    <InvoicesView
      invoices={invoices.data}
      error={invoices.isError && !invoices.data}
      onRetry={() => void invoices.refetch()}
      today={localToday(profile?.workspace?.timezone ?? "UTC")}
    />
  )
}
