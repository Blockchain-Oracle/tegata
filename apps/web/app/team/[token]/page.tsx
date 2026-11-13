import { teamInvite } from "@tegata/services"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { TeamInvitePage } from "@/components/team/team-invite"
import { db } from "@/lib/server/context.ts"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const invite = await teamInvite(db(), (await params).token)
  return {
    title: invite ? `Approve ${invite.business}'s payroll` : "Invite not found",
    robots: { index: false, follow: false },
  }
}

export default async function TeamInvite({ params }: Props) {
  const invite = await teamInvite(db(), (await params).token)
  if (!invite) notFound()
  return <TeamInvitePage invite={invite} />
}
