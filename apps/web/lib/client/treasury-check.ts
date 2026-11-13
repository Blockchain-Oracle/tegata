// The browser's own check before a key signs anything for a team treasury: the proposal's transfers must be exactly the
// rows on screen (who, how much, which memo), on the USDC contract, to this business's treasury, and nothing else.
import type { DelegateDraft } from "@tegata/core/near"

interface ScreenRow {
  id: string
  accountId: string | null
  amount: string
}

interface PayrollKind {
  FunctionCall?: {
    receiver_id?: string
    actions?: { method_name?: string; args?: string; deposit?: string }[]
  }
}

const decode = (base64: string) => {
  try {
    return JSON.parse(atob(base64)) as { receiver_id?: string; amount?: string; memo?: string }
  } catch {
    return {}
  }
}

/** The payroll proposal pays exactly these rows from USDC, one transfer each (matched by the memo's row id). */
export function payrollKindMatches(
  kind: unknown,
  usdc: string,
  rows: readonly ScreenRow[],
): boolean {
  const call = (kind as PayrollKind)?.FunctionCall
  if (!call || call.receiver_id !== usdc || !call.actions || call.actions.length !== rows.length)
    return false
  const byId = new Map(rows.map((row) => [row.id, row]))
  const seen = new Set<string>()
  return call.actions.every((action) => {
    const args = decode(action.args ?? "")
    const id = args.memo?.startsWith("tegata:payroll:")
      ? args.memo.slice("tegata:payroll:".length)
      : ""
    const row = byId.get(id)
    if (!row || seen.has(id)) return false
    seen.add(id)
    return (
      action.method_name === "ft_transfer" &&
      action.deposit === "1" &&
      args.receiver_id === row.accountId &&
      args.amount === row.amount
    )
  })
}

/** The owner's send: file the payroll on the treasury, then vote yes on that same proposal. */
export function proposeDraftMatches(
  draft: DelegateDraft,
  treasury: string,
  usdc: string,
  proposalId: number,
  rows: readonly ScreenRow[],
): boolean {
  const [add, vote] = draft.calls
  if (draft.receiverId !== treasury || draft.calls.length !== 2 || !add || !vote) return false
  if (
    add.method !== "add_proposal" ||
    vote.method !== "act_proposal" ||
    add.deposit !== "0" ||
    vote.deposit !== "0"
  )
    return false
  const filed = (JSON.parse(add.argsJson) as { proposal?: { kind?: unknown } }).proposal?.kind
  const voted = JSON.parse(vote.argsJson) as { id?: number; action?: string; proposal?: unknown }
  return (
    payrollKindMatches(filed, usdc, rows) &&
    voted.id === proposalId &&
    voted.action === "VoteApprove" &&
    JSON.stringify(voted.proposal) === JSON.stringify(filed)
  )
}

/** An approver's vote: one call on this treasury, on this proposal, whose transfers are the rows on screen. */
export function voteDraftMatches(
  draft: DelegateDraft,
  treasury: string,
  usdc: string,
  proposalId: number,
  vote: "approve" | "reject",
  rows: readonly ScreenRow[],
): boolean {
  const [call] = draft.calls
  if (draft.receiverId !== treasury || draft.calls.length !== 1 || call?.method !== "act_proposal")
    return false
  if (call.deposit !== "0") return false
  const args = JSON.parse(call.argsJson) as { id?: number; action?: string; proposal?: unknown }
  return (
    args.id === proposalId &&
    args.action === (vote === "approve" ? "VoteApprove" : "VoteReject") &&
    payrollKindMatches(args.proposal, usdc, rows)
  )
}
