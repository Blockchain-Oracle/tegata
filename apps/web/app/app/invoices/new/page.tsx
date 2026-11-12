"use client"

// A new invoice. `?customer=<id>` starts it for that customer (from Customers). `?from=guest` picks up an invoice
// built before signing in: its customer is added to the account and the same invoice opens, ready to send.
import { localToday } from "@tegata/core/invoices"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { BuilderPage } from "@/components/invoices/builder-page"
import { emptyDraft } from "@/components/invoices/invoice-builder"
import { Skeleton } from "@/components/kit/states"
import { useProfile } from "@/hooks/use-profile"
import { api } from "@/lib/client/api"
import { clearGuestDraft, loadGuestDraft } from "@/lib/client/guest-draft"
import type { Customer, DraftForm } from "@/lib/client/types"

export default function NewInvoicePage() {
  return (
    <Suspense>
      <NewInvoice />
    </Suspense>
  )
}

function NewInvoice() {
  const params = useSearchParams()
  const { profile } = useProfile()
  const tz = profile?.workspace?.timezone
  const fromGuest = params.get("from") === "guest"
  const [guest, setGuest] = useState<DraftForm | null | undefined>(fromGuest ? undefined : null)

  useEffect(() => {
    if (!fromGuest || !tz) return
    const saved = loadGuestDraft()
    if (!saved) {
      setGuest(null)
      return
    }
    void (async () => {
      let customerId: string | null = null
      if (saved.customer?.name.trim()) {
        const { customer } = await api<{ customer: Customer }>("/api/customers", {
          body: {
            name: saved.customer.name,
            email: saved.customer.email || null,
            address: saved.customer.address || null,
            taxId: saved.customer.taxId || null,
          },
        }).catch(() => ({ customer: null as Customer | null }))
        customerId = customer?.id ?? null
      }
      clearGuestDraft()
      setGuest({ ...saved.form, customerId })
    })()
  }, [fromGuest, tz])

  // The builder's dates start from today in the business's own time zone.
  if (!tz || guest === undefined)
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Opening your invoice">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[640px] rounded-[24px]" />
          <Skeleton className="h-[640px] rounded-[24px]" />
        </div>
      </div>
    )
  const customer = params.get("customer")
  return <BuilderPage initial={guest ?? { ...emptyDraft(localToday(tz)), customerId: customer }} />
}
