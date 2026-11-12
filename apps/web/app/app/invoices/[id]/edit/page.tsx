"use client"

// Edit a draft: load it, then the same builder. A sent invoice can't be edited and goes back to its page.
import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { BuilderPage, formOf } from "@/components/invoices/builder-page"
import { Skeleton } from "@/components/kit/states"
import { api } from "@/lib/client/api"
import type { InvoiceDetail } from "@/lib/client/types"

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const detail = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api<InvoiceDetail>(`/api/invoices/${id}`),
  })
  const sent = detail.data && !detail.data.draft
  useEffect(() => {
    if (sent) router.replace(`/app/invoices/${id}`)
  }, [sent, id, router])

  if (!detail.data?.draft)
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Loading the draft">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[640px] rounded-[24px]" />
          <Skeleton className="h-[640px] rounded-[24px]" />
        </div>
      </div>
    )
  return <BuilderPage invoiceId={id} initial={formOf(detail.data.draft)} />
}
