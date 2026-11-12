// A join link: who invited you and what you both get. Read on the server; not indexed.
import { REFERRALS } from "@tegata/config"
import { referrerByHandle } from "@tegata/services"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { db } from "@/lib/server/context.ts"

import { JoinView } from "./join-view"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ handle: string }> }

/** Join links are Sandbox until Live is switched on for referrals. */
const NETWORK = "testnet" as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const referrer = await referrerByHandle(db(), (await params).handle)
  if (!referrer) return { title: "Invite not found", robots: { index: false } }
  return {
    title: `${referrer.business} invited you`,
    description: `${referrer.business} uses Tegata to get paid in dollars from any chain. Join and you both get a reward.`,
    robots: { index: false, follow: false },
  }
}

export default async function JoinPage({ params }: Props) {
  const referrer = await referrerByHandle(db(), (await params).handle)
  if (!referrer?.handle) notFound()
  const rules = REFERRALS[NETWORK]
  return (
    <JoinView
      handle={referrer.handle}
      business={referrer.business}
      threshold={rules.threshold.toString()}
      reward={rules.reward.toString()}
      windowDays={rules.windowDays}
      sandbox
    />
  )
}
