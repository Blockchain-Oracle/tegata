"use client"

import { useQuery } from "@tanstack/react-query"
import { localToday } from "@tegata/core/invoices"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { InvoicesView } from "@/components/invoices/invoices-view"
import { useProfile } from "@/hooks/use-profile"
import { api } from "@/lib/client/api"
import type { InvoiceRow } from "@/lib/client/types"

const POLL_MS = 15_000

// `?q=` starts the search filled in (a customer's sheet links here with their name).
export default function InvoicesPage() {
  return (
    <Suspense>
      <Invoices />
    </Suspense>
  )
}

function Invoices() {
  const { profile } = useProfile()
  const initialQuery = useSearchParams().get("q") ?? ""
  const invoices = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api<{ invoices: InvoiceRow[] }>("/api/invoices"),
    select: (data) => data.invoices,
    refetchInterval: POLL_MS,
  })
  return (
    <InvoicesView
      initialQuery={initialQuery}
      invoices={invoices.data}
      error={invoices.isError && !invoices.data}
      onRetry={() => void invoices.refetch()}
      today={localToday(profile?.workspace?.timezone ?? "UTC")}
    />
  )
}
