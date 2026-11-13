"use client"

// The builder's logic for both "New invoice" and "Edit draft": load customers, save the draft, and on "Review and
// send" save it, show what will happen in a sheet, then send. Sending gives the invoice its number and public link
// and lands on its page with the seal pressed.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { localToday, percentText, quantityText } from "@tegata/core/invoices"
import { Check, Copy, Link2, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Sheet } from "@/components/shell/sheet"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { ApiError, api } from "@/lib/client/api"
import type { Customer, DraftForm, InvoiceDetail } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

import { CustomerDisc, type NewCustomer } from "./customer-picker"
import { type BuilderProblem, draftTotals, emptyDraft, InvoiceBuilder } from "./invoice-builder"
import { longDate } from "./invoice-paper"

/** A stored amount as the form's typed value ("1250.00"): an input, not a display, so no sign or separators. */
const inputDollars = (units: string) => viewDollars(units).toFixed(2)

/** The stored draft as the builder's form. */
export function formOf(draft: NonNullable<InvoiceDetail["draft"]>): DraftForm {
  return {
    customerId: draft.customerId,
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    notes: draft.notes ?? "",
    discount:
      draft.discount === null
        ? null
        : draft.discount.kind === "percent"
          ? { kind: "percent", value: percentText(draft.discount.bp) }
          : { kind: "fixed", value: inputDollars(draft.discount.amount) },
    taxRate: draft.taxBp ? percentText(draft.taxBp) : "",
    allowPartial: draft.allowPartial,
    reminders: draft.reminders,
    repeat: draft.repeat,
    lines:
      draft.lines.length > 0
        ? draft.lines.map((line) => ({
            description: line.description,
            quantity: quantityText(BigInt(line.quantityMilli)),
            unitPrice: inputDollars(line.unitPrice),
          }))
        : [{ description: "", quantity: "1", unitPrice: "" }],
  }
}

const problemOf = (error: unknown): BuilderProblem | null =>
  error
    ? error instanceof ApiError
      ? { field: error.code, message: error.message }
      : { field: null, message: "Couldn't save the invoice. Try again." }
    : null

export function BuilderPage({ initial, invoiceId }: { initial?: DraftForm; invoiceId?: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { profile } = useProfile()
  const [id, setId] = useState(invoiceId ?? null)
  const [review, setReview] = useState<DraftForm | null>(null)
  const [saving, setSaving] = useState<"draft" | "send" | null>(null)
  const [problem, setProblem] = useState<BuilderProblem | null>(null)

  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => api<{ customers: Customer[] }>("/api/customers"),
    select: (data) => data.customers,
  })
  const createCustomer = useMutation({
    mutationFn: (input: NewCustomer) =>
      api<{ customer: Customer }>("/api/customers", { body: input }),
    onError: () => fire("fail", { cue: "error" }),
  })

  async function save(form: DraftForm): Promise<string> {
    const body = { ...form, notes: form.notes || null }
    if (id) {
      await api(`/api/invoices/${id}`, { method: "PATCH", body })
      return id
    }
    const { invoice } = await api<{ invoice: { id: string } }>("/api/invoices", { body })
    setId(invoice.id)
    return invoice.id
  }

  const send = useMutation({
    mutationFn: (invoice: string) =>
      api<{ token: string; emailed: boolean }>(`/api/invoices/${invoice}/send`, { method: "POST" }),
    onSuccess: (_, invoice) => {
      fire("filled", { cue: "sent" })
      void queryClient.invalidateQueries({ queryKey: ["invoices"] })
      router.push(`/app/invoices/${invoice}?sent=1`)
    },
    onError: (error) => {
      fire("fail", { cue: "error" })
      setReview(null)
      setProblem(problemOf(error))
    },
  })

  const workspace = profile?.workspace
  const network = useNetwork()
  const account = profile?.accounts.find((entry) => entry.network === network)
  if (!workspace || !account) return null
  const today = localToday(workspace.timezone)
  const reviewCustomer = customers.data?.find((c) => c.id === review?.customerId)

  return (
    <>
      <InvoiceBuilder
        title={invoiceId ? "Edit draft" : "New invoice"}
        initial={initial ?? emptyDraft(today)}
        customers={customers.data}
        business={{
          from: {
            name: workspace.name,
            email: workspace.email,
            address: workspace.address,
            taxId: workspace.taxId,
          },
          logo: workspace.logo,
          payAddress: account.accountId,
          sandbox: account.network === "testnet",
        }}
        onCreateCustomer={(input, then) =>
          createCustomer.mutate(input, {
            onSuccess: ({ customer }) => {
              queryClient.setQueryData<{ customers: Customer[] }>(["customers"], (old) =>
                old ? { customers: [...old.customers, customer] } : old,
              )
              fire("tick", { cue: "confirmed" })
              then(customer)
            },
          })
        }
        creatingCustomer={createCustomer.isPending}
        customerProblem={
          createCustomer.error instanceof ApiError ? createCustomer.error.message : null
        }
        saving={saving}
        problem={problem}
        onSave={async (form) => {
          setSaving("draft")
          setProblem(null)
          try {
            const saved = await save(form)
            fire("tick", { cue: "confirmed" })
            void queryClient.invalidateQueries({ queryKey: ["invoices"] })
            router.push(`/app/invoices/${saved}`)
          } catch (error) {
            fire("fail", { cue: "error" })
            setProblem(problemOf(error))
          } finally {
            setSaving(null)
          }
        }}
        onSend={async (form) => {
          setSaving("send")
          setProblem(null)
          try {
            await save(form)
            if (!form.customerId) throw new ApiError(400, "customer", "Choose who you're billing")
            setReview(form)
          } catch (error) {
            fire("fail", { cue: "error" })
            setProblem(problemOf(error))
          } finally {
            setSaving(null)
          }
        }}
      />

      <Sheet
        open={review !== null}
        onOpenChange={(open) => !open && setReview(null)}
        title="Send this invoice?"
      >
        {review ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 rounded-[16px] bg-secondary p-4">
              <CustomerDisc name={reviewCustomer?.name ?? "?"} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[16px] font-semibold">{reviewCustomer?.name}</span>
                <span className="truncate text-detail text-muted-foreground">
                  Due {longDate(review.dueDate)}
                </span>
              </span>
              <Figure value={viewDollars(draftTotals(review).total)} className="text-[28px]" />
            </div>
            <ul className="flex flex-col gap-2">
              <CheckRow
                icon={<Link2 />}
                title="Pay link"
                detail={review.allowPartial ? "Part-payments on" : undefined}
              />
              {reviewCustomer?.email && profile?.emailEnabled ? (
                <CheckRow
                  icon={<Mail />}
                  title={`Email to ${reviewCustomer.email} + PDF`}
                  detail={review.reminders ? "Reminders on" : undefined}
                />
              ) : (
                <CheckRow
                  icon={<Copy />}
                  title={
                    reviewCustomer?.email
                      ? `You copy the link to ${reviewCustomer.email}`
                      : "You copy the link to send"
                  }
                />
              )}
            </ul>
            <Button
              busy={send.isPending}
              cue="tap"
              onClick={() => {
                if (id) send.mutate(id)
              }}
            >
              Send invoice
            </Button>
          </div>
        ) : null}
      </Sheet>
    </>
  )
}

/** One thing sending does, ticked. */
function CheckRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode
  title: string
  detail?: string
}) {
  return (
    <li className="flex items-center gap-3 rounded-[14px] bg-secondary px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-shu-wash text-shu-ink [&_svg]:size-[18px]">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{title}</span>
        {detail ? <span className="text-detail text-muted-foreground">{detail}</span> : null}
      </span>
      <Check className="size-5 shrink-0 text-up" aria-hidden />
    </li>
  )
}
