// A payslip (plan 6.8 S): one person's pay from one run, stamped by the business's seal, with the NEAR transaction
// that carried it. Public by its random id, so the person can keep it or show it.
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ReceiptView } from "@/components/receipt/receipt-view"
import { payslipView } from "@/lib/server/payroll.ts"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slip = await payslipView((await params).id)
  if (!slip) return { title: "Payslip not found", robots: { index: false } }
  return { title: `Payslip · ${slip.business}`, robots: { index: false, follow: false } }
}

export default async function PayslipPage({ params }: Props) {
  const { id } = await params
  const slip = await payslipView(id)
  if (!slip) notFound()
  return <ReceiptView receipt={slip} token={`slip:${id}`} />
}
