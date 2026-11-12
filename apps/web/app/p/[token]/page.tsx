// A person's own page (plan 6.8 P): who added them to payroll, their pay, and where it lands. Public by its token;
// choosing a destination needs a sign-in with the invited email. Not indexed.
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { personPageView } from "@/lib/server/payroll.ts"

import { PersonClient } from "./person-client"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await personPageView((await params).token)
  if (!page) return { title: "Page closed", robots: { index: false } }
  return {
    title: `${page.business} added you to payroll`,
    description: "Choose where your pay lands. No wallet needed.",
    robots: { index: false, follow: false },
  }
}

export default async function PersonPage({ params }: Props) {
  const page = await personPageView((await params).token)
  if (!page) notFound()
  return <PersonClient initial={page} />
}
