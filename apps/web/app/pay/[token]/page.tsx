// The public pay page. The server reads the link straight from the database, so the first paint already shows who
// is asking and how much; the client takes it from there. Not indexed: a pay link is shared, not searched.
import { NETWORKS } from "@tegata/config"
import { publicRequest } from "@tegata/services"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import type { PublicRequest } from "@/lib/client/types"
import { db } from "@/lib/server/context.ts"
import { PAYER_ROUTES } from "@/lib/server/oneclick.ts"

import { PayClient } from "./pay-client"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

async function load(token: string): Promise<PublicRequest | null> {
  const found = await publicRequest(db(), token)
  if (!found) return null
  const { request, business } = found
  return {
    token: request.token,
    business,
    title: request.title,
    note: request.note,
    amount: request.amount === null ? null : request.amount.toString(),
    status: request.status,
    network: request.network,
    receiverId: request.receiverId,
    usdc: NETWORKS[request.network].usdc,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const request = await load((await params).token)
  if (!request) return { title: "Pay link not found", robots: { index: false } }
  return {
    title: `Pay ${request.business}`,
    description: `${request.title}. Pay in dollars from any chain; ${request.business} receives USDC on NEAR.`,
    robots: { index: false, follow: false },
  }
}

export default async function PayPage({ params }: Props) {
  const request = await load((await params).token)
  if (!request) notFound()
  const routes = PAYER_ROUTES.map(({ id, symbol, chain, coin, chainMark }) => ({
    id,
    symbol,
    chain,
    coin,
    chainMark,
  }))
  return <PayClient initial={request} routes={routes} />
}
