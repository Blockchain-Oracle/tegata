"use client"

// Who the invoice is for (plan 6.8 K, PayPal flow 7395's inline customer): a search over the business's customers
// and "New customer" in a sheet without leaving the builder. The chosen customer shows as a card with Change.
import { Command } from "cmdk"
import { Check, ChevronDown, Plus, UserRound } from "lucide-react"
import { Popover } from "radix-ui"
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Sheet } from "@/components/shell/sheet"
import type { Customer } from "@/lib/client/types"
import { cn } from "@/lib/utils"

export interface NewCustomer {
  name: string
  email: string
  address: string
  taxId: string
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`
      : (words[0]?.slice(0, 2) ?? "?")
  ).toUpperCase()
}

export function CustomerDisc({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-sora font-semibold text-black"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

export function CustomerPicker({
  customers,
  value,
  onChange,
  onCreate,
  creating,
  createProblem,
  invalid,
}: {
  customers: Customer[] | undefined
  value: string | null
  onChange: (id: string) => void
  onCreate: (input: NewCustomer) => void
  creating: boolean
  createProblem: string | null
  invalid?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [form, setForm] = useState<NewCustomer>({ name: "", email: "", address: "", taxId: "" })
  const chosen = customers?.find((c) => c.id === value)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-detail font-medium text-muted-foreground">Bill to</span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              "press flex min-h-14 w-full items-center gap-3 rounded-[14px] bg-input px-3 py-2 text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--shu)]",
              invalid && "shadow-[0_0_0_2px_var(--down)]",
            )}
          >
            {chosen ? (
              <>
                <CustomerDisc name={chosen.name} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[16px] font-semibold">{chosen.name}</span>
                  <span className="truncate text-detail text-muted-foreground">
                    {chosen.email ?? "No email: you'll share the link yourself"}
                  </span>
                </span>
                <span className="text-detail font-semibold text-shu-ink">Change</span>
              </>
            ) : (
              <>
                <span className="grid size-10 place-items-center rounded-full bg-card">
                  <UserRound className="size-5 text-text-3" />
                </span>
                <span className="flex-1 text-[16px] font-medium text-text-3">
                  Choose a customer
                </span>
                <ChevronDown className="size-4 text-text-3" />
              </>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-[16px] bg-popover shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <Command label="Customers">
              <Command.Input
                autoFocus
                placeholder="Search customers…"
                className="h-12 w-full border-b border-secondary bg-transparent px-4 text-[16px] outline-none placeholder:text-text-3"
              />
              <Command.List className="max-h-72 overflow-y-auto p-1.5">
                <Command.Empty className="px-3 py-4 text-[14px] text-muted-foreground">
                  No customer by that name.
                </Command.Empty>
                {(customers ?? []).map((customer) => (
                  <Command.Item
                    key={customer.id}
                    value={`${customer.name} ${customer.email ?? ""}`}
                    onSelect={() => {
                      onChange(customer.id)
                      setOpen(false)
                    }}
                    className="flex h-12 cursor-pointer items-center gap-3 rounded-[10px] px-2.5 data-[selected=true]:bg-secondary"
                  >
                    <CustomerDisc name={customer.name} size={30} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-medium">{customer.name}</span>
                      {customer.email ? (
                        <span className="truncate text-[12px] text-muted-foreground">
                          {customer.email}
                        </span>
                      ) : null}
                    </span>
                    {customer.id === value ? <Check className="size-4" /> : null}
                  </Command.Item>
                ))}
                <Command.Item
                  value="+ new customer"
                  onSelect={() => {
                    setOpen(false)
                    setSheet(true)
                  }}
                  className="flex h-12 cursor-pointer items-center gap-3 rounded-[10px] px-2.5 font-semibold text-shu-ink data-[selected=true]:bg-secondary"
                >
                  <span className="grid size-[30px] place-items-center rounded-full bg-shu-wash">
                    <Plus className="size-4" />
                  </span>
                  New customer
                </Command.Item>
              </Command.List>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {invalid ? <span className="text-detail font-medium text-down">{invalid}</span> : null}

      <Sheet open={sheet} onOpenChange={setSheet} title="New customer">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.name.trim() || creating) return
            onCreate(form)
            setSheet(false)
            setForm({ name: "", email: "", address: "", taxId: "" })
          }}
        >
          <Field
            id="customer-name"
            label="Name"
            placeholder="Northwind Ltd"
            value={form.name}
            maxLength={80}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <Field
            id="customer-email"
            label="Email (optional)"
            type="email"
            placeholder="accounts@northwind.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <div className="flex flex-col gap-2">
            <label
              htmlFor="customer-address"
              className="text-detail font-medium text-muted-foreground"
            >
              Address (optional)
            </label>
            <textarea
              id="customer-address"
              rows={3}
              maxLength={300}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full resize-none rounded-[14px] bg-input px-4 py-3.5 text-[17px] font-medium outline-none focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]"
            />
          </div>
          <Field
            id="customer-tax"
            label="Tax ID (optional)"
            value={form.taxId}
            maxLength={40}
            onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
          />
          {createProblem ? (
            <p className="text-[15px] font-medium text-down">{createProblem}</p>
          ) : null}
          <Button type="submit" busy={creating} disabled={!form.name.trim()}>
            Add customer
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
