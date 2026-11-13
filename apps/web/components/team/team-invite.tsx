"use client"

// /team/<token>: someone was asked to approve a business's payroll. They sign in with the invited email (their own
// Tegata account opens if they have none), then join: their account goes into the treasury's approvers.
import { useMutation } from "@tanstack/react-query"
import { ArrowRight, Check, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { BusinessSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Stage } from "@/components/kit/stage"
import { useProfile } from "@/hooks/use-profile"
import { ApiError, api } from "@/lib/client/api"
import { rememberNext } from "@/lib/client/next-path"
import { rememberPayrollInvite } from "@/lib/client/payroll-invite"
import { fire } from "@/lib/feedback"

export interface TeamInviteView {
  token: string
  name: string
  emailHint: string
  network: "testnet" | "mainnet"
  business: string
  joined: boolean
  /** Not taken up in time: it no longer joins, and the owner sends a new link. */
  expired?: boolean
  accountId: string | null
}

export function TeamInvitePage({ invite }: { invite: TeamInviteView }) {
  const router = useRouter()
  const { profile } = useProfile()
  const signedIn = Boolean(profile)
  const join = useMutation({
    mutationFn: () =>
      api<{ joined: boolean }>(`/api/team/invite/${invite.token}`, { method: "POST" }),
    onSuccess: () => fire("confirm", { cue: "stamp" }),
    onError: (error) => {
      fire("fail", { cue: "error" })
      // No account on this network yet: open it (welcome asks their name), then come back here.
      if (error instanceof ApiError && error.code === "not_ready") {
        rememberNext(`/team/${invite.token}`)
        rememberPayrollInvite({
          token: invite.token,
          business: invite.business,
          choice: "tegata",
          role: "approver",
        })
        router.push("/welcome")
      }
    },
  })
  const done = invite.joined || join.isSuccess
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-6 px-4 py-8">
      <Stage className="p-6 sm:p-8">
        <div className="flex flex-col items-start gap-4">
          <span className="grid place-items-center rounded-full bg-white p-2 shadow-object">
            <BusinessSeal name={invite.business} size={72} />
          </span>
          <h1 className="display text-[40px] leading-[0.95] text-white sm:text-[48px]">
            {invite.business} asked you to approve its payroll
          </h1>
          <span className="text-[15px] text-white/85">
            Payroll waits for your yes before it pays. You vote with your own key on NEAR; Tegata
            pays the fees.
          </span>
        </div>
      </Stage>
      {invite.expired && !done ? (
        <div className="flex flex-col gap-3 rounded-[20px] bg-card p-5">
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold">
            <ShieldCheck className="size-5" /> This invite has expired
          </span>
          <span className="text-[15px] text-muted-foreground">
            Invites stay open for two weeks. Ask {invite.business} to send you a new one: it comes
            with a fresh link.
          </span>
        </div>
      ) : done ? (
        <div className="flex flex-col gap-3 rounded-[20px] bg-card p-5">
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold">
            <Check className="size-5 text-up" /> You approve {invite.business}'s payroll
          </span>
          <span className="text-[15px] text-muted-foreground">
            When they send a payroll, it waits in Approvals for your vote.
          </span>
          <Button asChild>
            <Link href="/app/approvals">
              Open Approvals <ArrowRight />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-[20px] bg-card p-5">
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold">
            <ShieldCheck className="size-5" /> For {invite.name}
          </span>
          <span className="text-[15px] text-muted-foreground">
            Sign in with {invite.emailHint}, the email they invited.
          </span>
          {join.error && !(join.error instanceof ApiError && join.error.code === "not_ready") ? (
            <p className="text-[14px] font-medium text-down">
              {join.error instanceof ApiError ? join.error.message : "That didn't go through"}
            </p>
          ) : null}
          {signedIn ? (
            <Button busy={join.isPending} onClick={() => join.mutate()}>
              Join as an approver
            </Button>
          ) : (
            <Button
              onClick={() => {
                rememberNext(`/team/${invite.token}`)
                rememberPayrollInvite({
                  token: invite.token,
                  business: invite.business,
                  choice: "tegata",
                  role: "approver",
                })
                router.push("/signin")
              }}
            >
              Sign in to join <ArrowRight />
            </Button>
          )}
        </div>
      )}
    </main>
  )
}
