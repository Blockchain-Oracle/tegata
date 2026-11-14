"use client"

// Team approvals in every state, on sample data: the Team page (just you, invited, ready to open, opening, sealing,
// ready) and one payroll as an approver sees it (needs you, you voted, paid, declined), plus the Approvals list.
import { useState } from "react"

import { Segmented } from "@/components/kit/segmented"
import { ApprovalDetailView, ApprovalsList } from "@/components/team/approvals-view"
import { type TeamData, TeamView } from "@/components/team/team-view"
import {
  SAMPLE_ACCOUNT,
  SAMPLE_APPROVAL,
  SAMPLE_BUSINESS,
  SAMPLE_TEAM_MEMBERS,
  SAMPLE_TREASURY,
} from "@/lib/dev/sample"

type TeamState = "alone" | "invited" | "expired" | "joined" | "creating" | "sealing" | "ready"
type VoteState = "needs" | "voted" | "paid" | "declined" | "failed"

const noop = () => undefined

function teamFor(state: TeamState): TeamData {
  const joined = SAMPLE_TEAM_MEMBERS.map((m) => ({
    ...m,
    status: "active" as const,
    accountId: m.accountId ?? "ben-osei.tegata.testnet",
  }))
  if (state === "alone") return { ownerAccount: SAMPLE_ACCOUNT, members: [], treasury: null }
  if (state === "invited")
    return { ownerAccount: SAMPLE_ACCOUNT, members: SAMPLE_TEAM_MEMBERS, treasury: null }
  if (state === "expired")
    return {
      ownerAccount: SAMPLE_ACCOUNT,
      members: SAMPLE_TEAM_MEMBERS.map((m, i) => (i === 1 ? { ...m, expired: true } : m)),
      treasury: null,
    }
  if (state === "joined") return { ownerAccount: SAMPLE_ACCOUNT, members: joined, treasury: null }
  return {
    ownerAccount: SAMPLE_ACCOUNT,
    members: joined,
    treasury: {
      ...SAMPLE_TREASURY,
      status: state === "creating" ? "creating" : state === "sealing" ? "sealing" : "ready",
    },
  }
}

function approvalFor(state: VoteState) {
  const voted = SAMPLE_APPROVAL.approvers.map((a) =>
    a.account === SAMPLE_APPROVAL.me
      ? { ...a, vote: "approve" as const, at: "2026-11-13T10:15:00.000Z" }
      : a,
  )
  if (state === "voted") return { ...SAMPLE_APPROVAL, approvers: voted, threshold: 3 }
  if (state === "paid")
    return {
      ...SAMPLE_APPROVAL,
      status: "paid",
      approvers: voted,
      rows: SAMPLE_APPROVAL.rows.map((r) => ({
        ...r,
        status: "paid",
        txHash: "FchxvDwS",
        txUrl: "#",
      })),
    }
  if (state === "failed")
    return {
      ...SAMPLE_APPROVAL,
      status: "failed",
      approvers: voted,
      error: "The treasury's batch didn't land, so nothing moved.",
      retryUntil: "2026-11-20T20:27:00.000Z",
    }
  if (state === "declined")
    return {
      ...SAMPLE_APPROVAL,
      status: "declined",
      approvers: SAMPLE_APPROVAL.approvers.map((a, i) =>
        i === 2 ? { ...a, vote: "reject" as const } : a,
      ),
    }
  return SAMPLE_APPROVAL
}

export default function TeamFlow() {
  const [team, setTeam] = useState<TeamState>("joined")
  const [vote, setVote] = useState<VoteState>("needs")
  return (
    <div className="flex flex-col gap-12 pt-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">Team</span>
          <Segmented
            label="Team state"
            value={team}
            onValueChange={(v) => setTeam(v as TeamState)}
            options={[
              { value: "alone", label: "Just you" },
              { value: "invited", label: "Invited" },
              { value: "expired", label: "Invite expired" },
              { value: "joined", label: "Ready to open" },
              { value: "creating", label: "Opening" },
              { value: "sealing", label: "Sealing" },
              { value: "ready", label: "Ready" },
            ]}
          />
        </div>
        <TeamView
          data={teamFor(team)}
          business={SAMPLE_BUSINESS}
          network="testnet"
          error={false}
          onRetry={noop}
          inviting={false}
          inviteProblem={null}
          lastInvite={null}
          onInvite={noop}
          onRemove={noop}
          opening={false}
          openProblem={null}
          onOpen={noop}
          sealing={false}
          sealProblem={null}
          onSeal={noop}
          funding={false}
          fundProblem={null}
          onFund={async () => undefined}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">An approval</span>
          <Segmented
            label="Approval state"
            value={vote}
            onValueChange={(v) => setVote(v as VoteState)}
            options={[
              { value: "needs", label: "Needs you" },
              { value: "voted", label: "You voted" },
              { value: "paid", label: "Paid" },
              { value: "declined", label: "Declined" },
              { value: "failed", label: "Failed" },
            ]}
          />
        </div>
        <ApprovalDetailView
          detail={approvalFor(vote)}
          error={false}
          onRetry={noop}
          busy={false}
          problem={null}
          onVote={() => setVote("paid")}
          onSendAgain={noop}
          onTryAgain={() => setVote("paid")}
        />
      </section>

      <section className="flex flex-col gap-4">
        <span className="display text-[30px]">Approvals</span>
        <ApprovalsList
          items={[
            {
              runId: SAMPLE_APPROVAL.runId,
              business: "Studio Kaze",
              label: SAMPLE_APPROVAL.label,
              total: SAMPLE_APPROVAL.total,
              status: "proposed",
              threshold: 2,
              approvers: 3,
              approvals: 1,
              myVote: null,
              mine: false,
            },
            {
              runId: "9c8d0000-0000-4000-8000-000000000003",
              business: "Northwind Coffee",
              label: "Pay · 1–31 Oct 2026",
              total: "1800000000",
              status: "paid",
              threshold: 2,
              approvers: 2,
              approvals: 2,
              myVote: "approve",
              mine: false,
            },
          ]}
          error={false}
          onRetry={noop}
        />
      </section>
    </div>
  )
}
