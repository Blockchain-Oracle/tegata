// Tegata Checkout: the pay page as it opens over a merchant's own site (from checkout.js). The only route another
// site may frame. The payment is the same as on /pay/<token>; the frame only tells the merchant's page that it
// opened, was paid or was closed. Proof of payment is never this message: it's the signed webhook.
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PayClient } from "@/app/pay/[token]/pay-client"
import { CheckoutFrame } from "@/components/pay/checkout-frame"
import { loadPublicRequest, payRoutes } from "@/lib/server/public-request.ts"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ parent?: string }>
}

/** The merchant page's origin, given by checkout.js; only ever an http(s) origin. */
function parentOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const request = await loadPublicRequest((await params).token)
  return {
    title: request ? `Pay ${request.business}` : "Checkout not found",
    robots: { index: false, follow: false },
  }
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const [{ token }, query] = await Promise.all([params, searchParams])
  const request = await loadPublicRequest(token)
  if (!request) notFound()
  const parent = parentOrigin(query.parent)
  return (
    <CheckoutFrame token={request.token} parent={parent}>
      <PayClient initial={request} routes={payRoutes()} embed={{ parent }} />
    </CheckoutFrame>
  )
}
