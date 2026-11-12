"use client"

// One vocabulary for an invoice's status and due date, everywhere it appears (list, page, public invoice).
import { daysBetween } from "@tegata/core/invoices"

import { StatusPill } from "@/components/kit/states"
import type { InvoiceStatus } from "@/lib/client/types"

const WORD: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partly_paid: "Partly paid",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
}

const TONE = {
  draft: "quiet",
  sent: "wait",
  viewed: "wait",
  partly_paid: "warn",
  overdue: "down",
  paid: "up",
  void: "quiet",
} as const

export function InvoiceStatusPill({
  status,
  className,
}: {
  status: InvoiceStatus
  className?: string
}) {
  return (
    <StatusPill tone={TONE[status]} className={className}>
      {WORD[status]}
    </StatusPill>
  )
}

export const statusWord = (status: InvoiceStatus) => WORD[status]

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

/** "Due in 5 days", "Due today", "3 days late", "Paid 12 Nov"… */
export function dueText(
  status: InvoiceStatus,
  dueDate: string,
  today: string,
  paidAt?: string | null,
) {
  if (status === "paid")
    return paidAt
      ? `Paid ${new Date(paidAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
      : "Paid"
  if (status === "void") return "Cancelled"
  if (status === "draft") return `Due ${shortDate(dueDate)}`
  const days = daysBetween(today, dueDate)
  if (days === 0) return "Due today"
  if (days > 0) return days === 1 ? "Due tomorrow" : `Due in ${days} days`
  return days === -1 ? "1 day late" : `${-days} days late`
}
