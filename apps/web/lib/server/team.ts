// Team approvals as the screens see them: base units as strings, dates as ISO strings.
import type { NetworkId } from "@tegata/config"
import { explorerAccount, explorerTx } from "@tegata/core/near"
import { approvalDetail, approvalsFor, inviteExpired, teamView } from "@tegata/services"

import { db } from "./context.ts"

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

export async function teamPageView(workspaceId: string, ownerId: string, network: NetworkId) {
  const view = await teamView(db(), workspaceId, ownerId, network)
  return {
    ownerAccount: view.ownerAccount,
    members: view.members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      status: m.status,
      accountId: m.accountId,
      token: m.token,
      invitedAt: iso(m.invitedAt),
      joinedAt: iso(m.joinedAt),
      expired: inviteExpired(m),
    })),
    treasury: view.treasury && {
      id: view.treasury.id,
      accountId: view.treasury.accountId,
      threshold: view.treasury.threshold,
      approvers: view.treasury.approvers,
      status: view.treasury.status,
      error: view.treasury.error,
      balance: view.treasury.balance.toString(),
      explorerUrl: explorerAccount(network, view.treasury.accountId),
      trezuUrl: network === "mainnet" ? `https://trezu.app/${view.treasury.accountId}` : null,
    },
  }
}

export async function approvalsView(userId: string, network: NetworkId) {
  const list = await approvalsFor(db(), userId, network)
  return list.map((a) => ({
    ...a,
    total: a.total.toString(),
    updatedAt: a.updatedAt.toISOString(),
  }))
}

export async function approvalDetailView(userId: string, runId: string) {
  const d = await approvalDetail(db(), userId, runId)
  if (!d) return null
  return {
    runId: d.run.id,
    status: d.run.status,
    business: d.business,
    logo: d.logo,
    label: d.label,
    total: d.run.total.toString(),
    network: d.run.network,
    treasury: d.treasury.accountId,
    treasuryUrl: explorerAccount(d.run.network, d.treasury.accountId),
    proposalId: d.run.proposalId,
    threshold: d.treasury.threshold,
    me: d.me,
    error: d.run.error,
    retryUntil: iso(d.retryUntil),
    rows: d.rows.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      accountId: r.accountId,
      destinationKind: r.destinationKind,
      amount: r.amount.toString(),
      status: r.status,
      txHash: r.txHash,
      txUrl: r.txHash ? explorerTx(d.run.network, r.txHash) : null,
    })),
    approvers: d.approvers.map((a) => ({ ...a, at: iso(a.at) })),
  }
}
