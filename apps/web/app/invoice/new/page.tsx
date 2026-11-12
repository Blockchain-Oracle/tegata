"use client"

// Guest mode (plan 6.8 K): build an invoice before signing in. The draft stays on this device; "Review and send"
// asks the person to sign in, then the same invoice opens in the app with its customer added, ready to send.
import { addDays, localToday } from "@tegata/core/invoices"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Lockup } from "@/components/brand/seal"
import { emptyDraft, InvoiceBuilder } from "@/components/invoices/invoice-builder"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import {
  type GuestCustomer,
  type GuestDraft,
  loadGuestDraft,
  saveGuestDraft,
} from "@/lib/client/guest-draft"
import { rememberNext } from "@/lib/client/next-path"
import type { Customer, DraftForm } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const GUEST_ID = "guest"

export default function GuestInvoicePage() {
  const router = useRouter()
  const [draft, setDraft] = useState<GuestDraft | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const today = localToday(Intl.DateTimeFormat().resolvedOptions().timeZone)
    setDraft(
      loadGuestDraft() ?? {
        business: "",
        customer: null,
        form: { ...emptyDraft(today), dueDate: addDays(today, 14) },
      },
    )
  }, [])
  if (!draft) return null

  const customers: Customer[] = draft.customer
    ? [
        {
          id: GUEST_ID,
          name: draft.customer.name,
          email: draft.customer.email || null,
          address: draft.customer.address || null,
          taxId: draft.customer.taxId || null,
        },
      ]
    : []
  const keep = (form: DraftForm, next: Partial<GuestDraft> = {}) =>
    setDraft((current) => {
      if (!current) return current
      const updated = { ...current, ...next, form }
      saveGuestDraft(updated)
      return updated
    })

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" aria-label="Tegata">
          <Lockup size={30} />
        </Link>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/signin">Sign in</Link>
        </Button>
      </header>
      <main className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 pb-16 sm:px-6">
        <div className="flex flex-col gap-4 rounded-[20px] bg-shu-wash p-5 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1 text-shu-ink">
            <span className="text-[17px] font-semibold">Try it without an account</span>
            <span className="text-[14px]">
              This stays on your device. Sign in when you send it and it opens in your account,
              ready to go.
            </span>
          </div>
          <div className="sm:w-72">
            <Field
              id="guest-business"
              label="Your business name"
              placeholder="Studio Kaze"
              value={draft.business}
              maxLength={60}
              onChange={(e) => {
                const business = e.target.value
                setDraft((current) => {
                  if (!current) return current
                  const updated = { ...current, business }
                  saveGuestDraft(updated)
                  return updated
                })
              }}
            />
          </div>
        </div>

        <InvoiceBuilder
          title="New invoice"
          initial={draft.form}
          customers={customers}
          business={{
            from: {
              name: draft.business.trim() || "Your business",
              email: null,
              address: null,
              taxId: null,
            },
            logo: null,
            payAddress: "your-name.tegata.near",
            sandbox: true,
          }}
          onCreateCustomer={(input, then) => {
            const customer: GuestCustomer = input
            setDraft((current) => {
              if (!current) return current
              const updated = { ...current, customer }
              saveGuestDraft(updated)
              return updated
            })
            fire("tick", { cue: "confirmed" })
            then({
              id: GUEST_ID,
              name: input.name,
              email: input.email || null,
              address: input.address || null,
              taxId: input.taxId || null,
            })
          }}
          creatingCustomer={false}
          customerProblem={null}
          saving={null}
          problem={null}
          onChange={(form) => keep(form)}
          onSave={(form) => {
            keep(form)
            setSaved(true)
            fire("tick", { cue: "confirmed" })
          }}
          onSend={(form) => {
            keep(form)
            rememberNext("/app/invoices/new?from=guest")
            fire("press", { cue: "tap" })
            router.push("/signin")
          }}
        />
        {saved ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-card p-5">
            <span className="text-[15px]">
              Saved on this device. Sign in to send it and get paid.
            </span>
            <Button
              onClick={() => {
                rememberNext("/app/invoices/new?from=guest")
                router.push("/signin")
              }}
            >
              Sign in to send <ArrowRight />
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  )
}
