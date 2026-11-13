// A team treasury on NEAR: one Sputnik DAO v2 per business that pays payroll only when k of n approvers vote yes.
// Each approver votes with their own key through Tegata's relayer; Tegata itself has no role in the policy, so it can't
// propose, vote or move anything. These are the policies, the payroll proposal and the calls; services decide when.
import { NETWORKS, type NetworkId, TREASURY, treasuryVoteGas } from "@tegata/config"

import { type CallSpec, call } from "./calls.ts"
import { view } from "./provider.ts"

/** Proposal labels (Sputnik's `ProposalKind::to_label`) a policy change touches. */
const GOVERNANCE_LABELS = [
  "config",
  "policy",
  "add_member_to_role",
  "remove_member_from_role",
  "upgrade_self",
  "upgrade_remote",
  "set_vote_token",
  "factory_info_update",
  "policy_add_or_update_role",
  "policy_remove_role",
  "policy_update_default_vote_policy",
  "policy_update_parameters",
] as const
const MONEY_LABELS = ["call", "transfer"] as const

const kOfN = (k: number) => ({ weight_kind: "RoleWeight", quorum: String(k), threshold: String(k) })

export interface TreasuryMembers {
  /** The business owner's account: files proposals, and is one of the approvers. */
  owner: string
  /** Every approver, the owner included. */
  approvers: string[]
  /** Approvals needed. */
  threshold: number
}

/**
 * The policy a treasury lives by once sealed. The owner may file proposals (payroll, and policy or config changes);
 * every proposal of every kind passes only with k of n approvers (quorum k, so removing people never lowers it).
 * No role can remove proposals, and nobody else, Tegata included, appears in it.
 */
export function sealedPolicy(m: TreasuryMembers) {
  const labels = [...MONEY_LABELS, ...GOVERNANCE_LABELS]
  return {
    roles: [
      {
        name: "Requestor",
        kind: { Group: [m.owner] },
        permissions: labels.map((label) => `${label}:AddProposal`),
        vote_policy: {},
      },
      {
        name: "Approver",
        kind: { Group: m.approvers },
        permissions: labels.flatMap((label) => [
          `${label}:VoteApprove`,
          `${label}:VoteReject`,
          `${label}:Finalize`,
        ]),
        vote_policy: Object.fromEntries(labels.map((label) => [label, kOfN(m.threshold)])),
      },
    ],
    default_vote_policy: kOfN(m.threshold),
    proposal_bond: "0",
    proposal_period: TREASURY.periodNs.toString(),
    bounty_bond: "0",
    bounty_forgiveness_period: "86400000000000",
  }
}

/**
 * The policy a treasury starts with: the sealed one plus the owner alone as Admin for the two changes that seal it
 * (switching off automatic code updates, then dropping this Admin role). Nothing can be paid before the seal: the
 * treasury holds nothing until the owner funds it, and funding waits for the seal.
 */
export function bootstrapPolicy(m: TreasuryMembers) {
  const sealed = sealedPolicy(m)
  return {
    ...sealed,
    roles: [
      ...sealed.roles,
      {
        name: "Admin",
        kind: { Group: [m.owner] },
        permissions: ["factory_info_update:*", "policy:*"],
        vote_policy: { factory_info_update: kOfN(1), policy: kOfN(1) },
      },
    ],
  }
}

export function treasuryConfig(business: string) {
  return {
    name: business.slice(0, 64),
    purpose: `${business} payroll, approved by its team on Tegata`,
    metadata: "",
  }
}

/** The factory's `create` (mainnet): the treasury at `<name>.sputnik-dao.near`, initialised with `init`. */
export function factoryCreate(name: string, init: { config: object; policy: object }): CallSpec {
  return call(
    "create",
    { name, args: Buffer.from(JSON.stringify(init)).toString("base64") },
    TREASURY.initGas + 100n * 1_000_000_000_000n,
    TREASURY.startYocto,
  )
}

export interface PayrollTransfer {
  receiverId: string
  amount: bigint
  memo: string
}

/** One payroll as a proposal kind: one `ft_transfer` on USDC per row, all sent in one batch when it passes. */
export function payrollKind(network: NetworkId, rows: readonly PayrollTransfer[]) {
  return {
    FunctionCall: {
      receiver_id: NETWORKS[network].usdc,
      actions: rows.map((row) => ({
        method_name: "ft_transfer",
        args: Buffer.from(
          JSON.stringify({
            receiver_id: row.receiverId,
            amount: row.amount.toString(),
            memo: row.memo,
          }),
        ).toString("base64"),
        deposit: "1",
        gas: TREASURY.rowGas.toString(),
      })),
    },
  }
}

export type ProposalKind = Record<string, unknown>

/** File a proposal (the Requestor; bond 0, so no deposit). */
export function addProposal(description: string, kind: ProposalKind): CallSpec {
  return call("add_proposal", { proposal: { description, kind } }, TREASURY.proposeGas)
}

/**
 * Vote on proposal `id`. The kind must match the stored one field for field (the contract refuses otherwise), so a
 * vote can never land on a different proposal. `rows`: transfers it would pay, for the gas if this vote is the last.
 */
export function actProposal(
  id: number,
  action: "VoteApprove" | "VoteReject" | "Finalize",
  kind: ProposalKind,
  rows: number,
  memo?: string,
): CallSpec {
  return call(
    "act_proposal",
    { id, action, proposal: kind, ...(memo ? { memo } : {}) },
    rows > 0 ? treasuryVoteGas(rows) : TREASURY.voteGas,
  )
}

/** The seal: no automatic code updates, then the sealed policy (each filed and approved by the owner as Admin). */
export function sealCalls(m: TreasuryMembers, factoryId: string): CallSpec[] {
  const noUpdates = {
    FactoryInfoUpdate: { factory_info: { factory_id: factoryId, auto_update: false } },
  }
  const seal = { ChangePolicy: { policy: sealedPolicy(m) } }
  return [
    call(
      "add_proposal",
      { proposal: { description: "Tegata: no automatic code updates", kind: noUpdates } },
      TREASURY.voteGas,
    ),
    call("act_proposal", { id: 0, action: "VoteApprove", proposal: noUpdates }, TREASURY.voteGas),
    call(
      "add_proposal",
      { proposal: { description: "Tegata: every change needs the approvers", kind: seal } },
      TREASURY.voteGas,
    ),
    call("act_proposal", { id: 1, action: "VoteApprove", proposal: seal }, TREASURY.voteGas),
  ]
}

export type ProposalStatus =
  | "InProgress"
  | "Approved"
  | "Rejected"
  | "Removed"
  | "Expired"
  | "Moved"
  | "Failed"

export interface ProposalView {
  id: number
  proposer: string
  description: string
  kind: ProposalKind
  status: ProposalStatus
  vote_counts: Record<string, [string, string, string]>
  votes: Record<string, "Approve" | "Reject" | "Remove">
  /** Nanoseconds, as a string. */
  submission_time: string
}

export const treasuryProposal = (network: NetworkId, treasury: string, id: number) =>
  view<ProposalView>(network, treasury, "get_proposal", { id })
export const treasuryLastProposalId = (network: NetworkId, treasury: string) =>
  view<number>(network, treasury, "get_last_proposal_id")
export const treasuryFactoryInfo = (network: NetworkId, treasury: string) =>
  view<{ factory_id: string; auto_update: boolean }>(network, treasury, "get_factory_info")
export const treasuryPolicy = (network: NetworkId, treasury: string) =>
  view<{ roles: { name: string; kind: { Group?: string[] } }[] }>(network, treasury, "get_policy")
/** NEAR it can spend on new proposals (balance less storage), yocto as a string. */
export const treasuryAvailable = (network: NetworkId, treasury: string) =>
  view<string>(network, treasury, "get_available_amount")

/** Where a business's treasury lives: on mainnet under the factory (Trezu lists it), on testnet under the operator. */
export function treasuryAccountId(network: NetworkId, handle: string): string {
  return network === "mainnet"
    ? `${handle}.${TREASURY.mainnetFactory}`
    : `${handle}-team.${NETWORKS.testnet.operator}`
}
