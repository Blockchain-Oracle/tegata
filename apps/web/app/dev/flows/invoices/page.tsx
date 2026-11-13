"use client"

// Invoices in every state: the list, the builder (live), one invoice (sent, partly paid, paid, void) and
// the public invoice the customer opens, on sample data that lives only under /dev.
import { localToday } from "@tegata/core/invoices"
import { useState } from "react"

import { emptyDraft, InvoiceBuilder } from "@/components/invoices/invoice-builder"
import { InvoiceDetailView } from "@/components/invoices/invoice-detail-view"
import { InvoicesView } from "@/components/invoices/invoices-view"
import { PublicInvoice } from "@/components/invoices/public-invoice"
import { Segmented } from "@/components/kit/segmented"
import type { InvoiceDetail } from "@/lib/client/types"
import {
  SAMPLE_ACCOUNT,
  SAMPLE_BUSINESS,
  SAMPLE_CUSTOMERS,
  SAMPLE_INVOICE,
  SAMPLE_INVOICES,
} from "@/lib/dev/sample"

type ListState = "full" | "empty" | "loading" | "error"
type InvoiceState = "sent" | "partly" | "paid" | "void"

function detailFor(state: InvoiceState): InvoiceDetail {
  const base = SAMPLE_INVOICE
  if (state === "sent")
    return {
      ...base,
      payments: [],
      paidTotal: "0",
      remaining: base.invoice.total,
      status: "viewed",
      events: base.events.slice(0, 4),
    }
  if (state === "paid")
    return {
      ...base,
      invoice: { ...base.invoice, status: "paid", paidAt: new Date().toISOString() },
      paidTotal: base.invoice.total,
      remaining: "0",
      status: "paid",
      events: [
        ...base.events,
        { id: "e6", kind: "paid", detail: null, createdAt: new Date().toISOString() },
      ],
    }
  if (state === "void")
    return {
      ...base,
      invoice: { ...base.invoice, status: "void", voidedAt: new Date().toISOString() },
      remaining: "0",
      status: "void",
      events: [
        ...base.events,
        { id: "e6", kind: "voided", detail: null, createdAt: new Date().toISOString() },
      ],
    }
  return base
}

export default function InvoicesFlow() {
  const today = localToday("Africa/Lagos")
  const [list, setList] = useState<ListState>("full")
  const [state, setState] = useState<InvoiceState>("partly")
  const [publicState, setPublicState] = useState<InvoiceState>("partly")
  const detail = detailFor(state)
  const pub = detailFor(publicState)

  return (
    <div className="flex flex-col gap-12 pt-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">Invoices</span>
          <Segmented
            label="List state"
            value={list}
            onValueChange={(v) => setList(v as ListState)}
            options={[
              { value: "full", label: "With invoices" },
              { value: "empty", label: "Empty" },
              { value: "loading", label: "Loading" },
              { value: "error", label: "Error" },
            ]}
          />
        </div>
        <InvoicesView
          invoices={list === "full" ? SAMPLE_INVOICES : list === "empty" ? [] : undefined}
          error={list === "error"}
          onRetry={() => setList("full")}
          today={today}
        />
      </section>

      <section className="flex flex-col gap-4">
        <span className="display text-[30px]">Builder</span>
        <InvoiceBuilder
          title="New invoice"
          initial={{
            ...emptyDraft(today),
            customerId: "c1",
            taxRate: "7.5",
            discount: { kind: "percent", value: "10" },
            lines: [
              {
                description: "Brand identity: logo, seal and colour system",
                quantity: "1",
                unitPrice: "1200",
              },
              { description: "Design hours", quantity: "6.5", unitPrice: "45" },
            ],
          }}
          customers={SAMPLE_CUSTOMERS}
          business={{
            from: {
              name: SAMPLE_BUSINESS,
              email: "accounts@studiokaze.com",
              address: "12 Market Street\nLagos 100001",
              taxId: null,
            },
            logo: null,
            payAddress: SAMPLE_ACCOUNT,
            sandbox: true,
          }}
          onCreateCustomer={() => undefined}
          creatingCustomer={false}
          customerProblem={null}
          saving={null}
          problem={null}
          onSave={() => undefined}
          onSend={() => undefined}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">One invoice</span>
          <Segmented
            label="Invoice state"
            value={state}
            onValueChange={(v) => setState(v as InvoiceState)}
            options={[
              { value: "sent", label: "Sent" },
              { value: "partly", label: "Partly paid" },
              { value: "paid", label: "Paid" },
              { value: "void", label: "Void" },
            ]}
          />
        </div>
        <InvoiceDetailView
          key={state}
          detail={detail}
          error={false}
          onRetry={() => undefined}
          logo={null}
          today={today}
          url="https://tegata.xyz/i/h7Kq2mPx9cRt"
          justSent={state === "sent"}
          pressSeal={state === "paid"}
          busy={null}
          problem={null}
          onVoid={() => setState("void")}
          onMarkPaid={() => setState("paid")}
          onDuplicate={() => undefined}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">What the customer opens</span>
          <Segmented
            label="Public state"
            value={publicState}
            onValueChange={(v) => setPublicState(v as InvoiceState)}
            options={[
              { value: "sent", label: "Unpaid" },
              { value: "partly", label: "Partly paid" },
              { value: "paid", label: "Paid" },
              { value: "void", label: "Void" },
            ]}
          />
        </div>
        <div className="relative overflow-hidden rounded-[24px] ring-1 ring-secondary [transform:translateZ(0)]">
          <PublicInvoice
            preview
            data={{
              token: "h7Kq2mPx9cRt",
              number: "INV-0007",
              status: pub.status,
              stored:
                pub.invoice.status === "paid"
                  ? "paid"
                  : pub.invoice.status === "void"
                    ? "void"
                    : "open",
              from: pub.invoice.billFrom ?? {
                name: SAMPLE_BUSINESS,
                email: null,
                address: null,
                taxId: null,
              },
              logo: null,
              to: pub.invoice.billTo,
              issueDate: pub.invoice.issueDate,
              dueDate: pub.invoice.dueDate,
              lines: pub.lines.map((l) => ({
                description: l.description,
                quantity: String(Number(l.quantityMilli) / 1000),
                unitPrice: l.unitPrice,
                amount: l.amount,
              })),
              subtotal: pub.invoice.subtotal,
              discount: pub.invoice.discount,
              discountLabel: "Discount 10%",
              tax: pub.invoice.tax,
              taxLabel: "Tax 7.5%",
              total: pub.invoice.total,
              paidTotal: pub.paidTotal,
              remaining: pub.remaining,
              notes: pub.invoice.notes,
              receiverId: SAMPLE_ACCOUNT,
              sandbox: true,
              today,
              receipts: pub.payments.map((p) => ({
                token: p.receiptToken ?? "sample",
                amount: p.amount,
                rail: p.rail,
                settledAt: p.settledAt,
              })),
            }}
          />
        </div>
      </section>
    </div>
  )
}
