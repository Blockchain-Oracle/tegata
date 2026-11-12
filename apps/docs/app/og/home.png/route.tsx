import { ogImage } from "@/lib/og"
import { SITE } from "@/lib/site"

export const revalidate = false

/** The front page's link preview. */
export async function GET() {
  return ogImage({
    kicker: "Docs",
    title: SITE.headline,
    description: "Invoices, pay links and payroll, settled in USDC on NEAR.",
  })
}
