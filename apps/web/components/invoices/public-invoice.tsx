"use client"

// The invoice the customer opens, phone first: the document on the stage, and a bar that stays at the
// bottom with what is left to pay and the Pay button (it opens the pay page for this invoice). Paid: the PAID seal
// and the receipts. Void: a band, no pay bar. The first open by anyone but the owner records "Viewed".
import { ArrowRight, Download, ReceiptText } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

import { BusinessSeal, TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Stage } from "@/components/kit/stage"
import { railWord } from "@/components/links/link-detail-view"
import { Mark } from "@/components/marks/mark"
import { PaidWithMark } from "@/components/marks/paid-with"
import { api } from "@/lib/client/api"
import type { InvoiceStatus, PaymentRail } from "@/lib/client/types"
import { usdUnits } from "@/lib/fiat"

import { InvoicePaper, type PaperLine, type Party } from "./invoice-paper"
import { dueText, InvoiceStatusPill } from "./status"

export interface PublicInvoiceData {
  token: string
  number: string
  status: InvoiceStatus
  stored: "open" | "paid" | "void"
  from: Party
  logo: string | null
  to: Party | null
  issueDate: string
  dueDate: string
  lines: (Omit<PaperLine, "unitPrice" | "amount"> & { unitPrice: string; amount: string })[]
  subtotal: string
  discount: string
  discountLabel: string | null
  tax: string
  taxLabel: string | null
  total: string
  paidTotal: string
  remaining: string
  notes: string | null
  receiverId: string
  sandbox: boolean
  today: string
  receipts: {
    token: string
    amount: string
    rail: PaymentRail
    /** Paid through NEAR Intents: the coin and chain it came from (a 1Click asset id). */
    assetIn?: string | null
    settledAt: string | null
  }[]
}

export function PublicInvoice({
  data,
  preview = false,
}: {
  data: PublicInvoiceData
  preview?: boolean
}) {
  useEffect(() => {
    if (preview) return
    void api(`/api/i/${data.token}/viewed`, { method: "POST" }).catch(() => undefined)
  }, [data.token, preview])

  const remaining = BigInt(data.remaining)
  const payable = data.stored === "open" && remaining > 0n

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 pt-6 pb-36 sm:pt-10">
        <header className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-card shadow-object">
            {data.logo ? (
              <img src={data.logo} alt="" className="size-full object-cover" />
            ) : (
              <BusinessSeal name={data.from.name} size={42} tilt={-4} />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] text-muted-foreground">Invoice from</span>
            <span className="truncate text-[18px] font-semibold">{data.from.name}</span>
          </span>
          <InvoiceStatusPill status={data.status} />
        </header>

        <Stage className="p-3 sm:p-6" grid={false}>
          <InvoicePaper
            from={data.from}
            logo={data.logo}
            to={data.to}
            number={data.number}
            issueDate={data.issueDate}
            dueDate={data.dueDate}
            lines={data.lines.map((line) => ({
              ...line,
              unitPrice: BigInt(line.unitPrice),
              amount: BigInt(line.amount),
            }))}
            subtotal={BigInt(data.subtotal)}
            discount={BigInt(data.discount)}
            discountLabel={data.discountLabel}
            tax={BigInt(data.tax)}
            taxLabel={data.taxLabel}
            total={BigInt(data.total)}
            notes={data.notes}
            payAddress={data.receiverId}
            sandbox={data.sandbox}
            stamp={
              data.stored === "paid"
                ? "paid"
                : data.stored === "void"
                  ? "void"
                  : BigInt(data.paidTotal) > 0n
                    ? "partly"
                    : null
            }
            paidTotal={BigInt(data.paidTotal)}
          />
        </Stage>

        {data.receipts.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-section-title font-semibold">Payments</h2>
            <div className="flex flex-col rounded-[20px] bg-card p-2">
              {data.receipts.map((receipt) => (
                <Link
                  key={receipt.token}
                  href={`/r/${receipt.token}`}
                  className="press flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-secondary"
                >
                  <PaidWithMark rail={receipt.rail} assetIn={receipt.assetIn} size={36} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold">
                      {railWord(receipt.rail, receipt.assetIn)}
                    </span>
                    <span className="text-detail text-muted-foreground">
                      {receipt.settledAt
                        ? new Date(receipt.settledAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </span>
                  </span>
                  <span className="tnum text-[15px] font-semibold text-up">
                    +{usdUnits(receipt.amount)}
                  </span>
                  <ReceiptText className="size-4 text-text-3" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="flex flex-col items-center gap-2 pt-2 text-meta text-muted-foreground">
          {data.receipts.length > 0 && data.receipts.every((r) => r.rail === "manual") ? (
            // Paid only by hand: nothing about it moved on NEAR, so the footer doesn't say it settled there.
            <span>Paid by hand · recorded by the business, not on NEAR</span>
          ) : (
            <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <Mark id="near" size={16} /> Settled on NEAR
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Mark id="intents" size={16} /> Powered by NEAR Intents
              </span>
            </span>
          )}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-semibold hover:text-foreground"
          >
            <TegataSeal size={14} textured={false} tilt={0} /> Tegata
          </Link>
        </footer>
      </div>

      {payable ? (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-[760px] items-center gap-3 rounded-[24px] bg-card p-3 pl-5 shadow-float">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-detail text-muted-foreground">
                {dueText(data.status, data.dueDate, data.today)}
              </span>
              <span className="tnum text-[20px] font-semibold">{usdUnits(remaining)}</span>
            </span>
            <Button variant="ghost" size="icon" asChild aria-label="Download PDF">
              <a href={`/i/${data.token}/pdf`}>
                <Download />
              </a>
            </Button>
            <Button variant="shu" asChild>
              <Link href={`/pay/${data.token}`}>
                Pay {usdUnits(remaining)} <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mx-auto -mt-28 flex max-w-[760px] justify-center px-4 pb-10">
          <Button variant="secondary" asChild>
            <a href={`/i/${data.token}/pdf`}>
              <Download /> Download PDF
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}
