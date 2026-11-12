"use client"

// Customers (plan 6.8 N): everyone the business bills, with what they were billed, paid and still owe. A row opens a
// sheet to edit them or start an invoice for them. Empty: a sora tile.
import { FileText, Plus, Search, Users } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { CustomerDisc } from "@/components/invoices/customer-picker"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Figure, viewDollars } from "@/components/kit/figure"
import { EmptyState, ErrorState, LoadingShape } from "@/components/kit/states"
import { Sheet } from "@/components/shell/sheet"
import type { Customer } from "@/lib/client/types"
import { cn } from "@/lib/utils"

export interface CustomerForm {
  name: string
  email: string
  address: string
  taxId: string
}

const blank: CustomerForm = { name: "", email: "", address: "", taxId: "" }

export function CustomersView({
  customers,
  error,
  onRetry,
  saving,
  problem,
  onSave,
}: {
  customers: Customer[] | undefined
  error: boolean
  onRetry: () => void
  saving: boolean
  problem: string | null
  onSave: (id: string | null, form: CustomerForm, done: () => void) => void
}) {
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Customer | "new" | null>(null)
  const [form, setForm] = useState<CustomerForm>(blank)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (customers ?? []).filter(
      (c) => !q || c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q),
    )
  }, [customers, query])

  const open = (customer: Customer | "new") => {
    setEditing(customer)
    setForm(
      customer === "new"
        ? blank
        : {
            name: customer.name,
            email: customer.email ?? "",
            address: customer.address ?? "",
            taxId: customer.taxId ?? "",
          },
    )
  }
  const current = editing && editing !== "new" ? editing : null

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="display text-page-title">Customers</h1>
        <Button variant="shu" size="md" onClick={() => open("new")}>
          <Plus /> New customer
        </Button>
      </header>

      {error ? (
        <ErrorState title="Couldn't load your customers" onRetry={onRetry} />
      ) : customers === undefined ? (
        <div className="rounded-[20px] bg-card p-3">
          <LoadingShape shape="list" />
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          art={<Users />}
          field="sora"
          title="No customers yet"
          detail="Add the people and companies you bill. They're also added when you make an invoice."
          action={
            <Button variant="shu" onClick={() => open("new")}>
              <Plus /> New customer
            </Button>
          }
        />
      ) : (
        <>
          <label className="flex h-11 items-center gap-2 rounded-[12px] bg-card px-3 sm:w-72">
            <Search className="size-4 text-text-3" />
            <span className="sr-only">Search customers</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or email"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-3"
            />
          </label>
          <div className="flex flex-col rounded-[20px] bg-card p-2">
            {shown.map((customer) => {
              const owed = BigInt(customer.outstanding ?? "0")
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => open(customer)}
                  className="press flex items-center gap-3 rounded-[14px] px-3 py-3 text-left hover:bg-secondary"
                >
                  <CustomerDisc name={customer.name} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[16px] font-semibold">{customer.name}</span>
                    <span className="truncate text-detail text-muted-foreground">
                      {customer.email ?? "No email"} · {customer.invoices ?? 0}{" "}
                      {customer.invoices === 1 ? "invoice" : "invoices"}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span
                      className={cn("tnum text-[16px] font-semibold", owed > 0n && "text-warn")}
                    >
                      ${viewDollars(owed).toFixed(2)}
                    </span>
                    <span className="text-[12px] text-muted-foreground">owed</span>
                  </span>
                </button>
              )
            })}
            {shown.length === 0 ? (
              <span className="px-3 py-6 text-center text-[15px] text-muted-foreground">
                No one by that name.
              </span>
            ) : null}
          </div>
        </>
      )}

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? current.name : "New customer"}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSave(current?.id ?? null, form, () => setEditing(null))
          }}
        >
          {current ? (
            <div className="grid grid-cols-3 gap-2 rounded-[16px] bg-secondary p-3 text-center">
              <Stat label="Billed" units={current.invoiced ?? "0"} />
              <Stat label="Paid" units={current.paid ?? "0"} />
              <Stat label="Owed" units={current.outstanding ?? "0"} />
            </div>
          ) : null}
          <Field
            id="cust-name"
            label="Name"
            value={form.name}
            maxLength={80}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Field
            id="cust-email"
            label="Email (optional)"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="cust-address" className="text-detail font-medium text-muted-foreground">
              Address (optional)
            </label>
            <textarea
              id="cust-address"
              rows={3}
              maxLength={300}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full resize-none rounded-[14px] bg-input px-4 py-3.5 text-[17px] font-medium outline-none focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]"
            />
          </div>
          <Field
            id="cust-tax"
            label="Tax ID (optional)"
            value={form.taxId}
            maxLength={40}
            onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
          />
          {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
          <Button type="submit" busy={saving} disabled={!form.name.trim()}>
            {current ? "Save" : "Add customer"}
          </Button>
          {current ? (
            <Button variant="secondary" asChild>
              <Link href={`/app/invoices/new?customer=${current.id}`}>
                <FileText /> New invoice for them
              </Link>
            </Button>
          ) : null}
        </form>
      </Sheet>
    </div>
  )
}

function Stat({ label, units }: { label: string; units: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <Figure value={viewDollars(units)} className="text-[20px]" />
    </span>
  )
}
