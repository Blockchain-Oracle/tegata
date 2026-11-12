"use client"

// A new invoice; `?customer=<id>` starts it for that customer (from the Customers page).
import { localToday } from "@tegata/core/invoices"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { BuilderPage } from "@/components/invoices/builder-page"
import { emptyDraft } from "@/components/invoices/invoice-builder"
import { useProfile } from "@/hooks/use-profile"

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
  // The builder's dates start from today in the business's own time zone.
  const tz = profile?.workspace?.timezone
  if (!tz) return null
  const customer = params.get("customer")
  return <BuilderPage initial={{ ...emptyDraft(localToday(tz)), customerId: customer }} />
}
