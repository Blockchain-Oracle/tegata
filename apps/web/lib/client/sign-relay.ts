"use client"

// Sign a gas-free action the server drafted, after checking it is exactly what the screen shows, then follow it to
// its final state on NEAR. Used by the autopilot's actions (pause, resume, turn off, add money, withdraw).
import type { DelegateDraft } from "@tegata/core/near"

import { api } from "@/lib/client/api"
import type { RelayStatus } from "@/lib/client/types"

export interface Approval {
  relayId: string
  signature?: string
  signedDelegate?: string
}

const POLL_MS = 1_500
const MAX_POLLS = 80

export interface ExpectedCall {
  receiverId: string
  method: string
  /** Every key here must equal the call's argument (compared as JSON). */
  args: Record<string, unknown>
}

/** Throws unless the draft is one call, to `receiverId`, of `method`, with these arguments, and its hash is honest. */
export async function checkDraft(draft: DelegateDraft, expected: ExpectedCall): Promise<void> {
  const { draftMatchesHash } = await import("@tegata/core/near")
  const call = draft.calls[0]
  const args = call ? (JSON.parse(call.argsJson) as Record<string, unknown>) : {}
  const same = Object.entries(expected.args).every(
    ([key, value]) => JSON.stringify(args[key]) === JSON.stringify(value),
  )
  if (
    !draftMatchesHash(draft) ||
    draft.receiverId !== expected.receiverId ||
    draft.calls.length !== 1 ||
    call?.method !== expected.method ||
    !same
  ) {
    throw new Error("The action to approve doesn't match what you reviewed")
  }
}

export async function followRelay(relayId: string): Promise<RelayStatus> {
  for (let i = 0; i < MAX_POLLS; i++) {
    const relay = await api<RelayStatus>(`/api/relay/${relayId}`)
    if (relay.status === "success") return relay
    if (relay.status === "failed" || relay.status === "expired")
      throw new Error(relay.error ?? "NEAR didn't accept it. Nothing moved.")
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
  throw new Error("Still waiting on NEAR. Check again in a minute.")
}

/** Check, approve as the signed-in person (their key or their wallet), submit, and wait until NEAR has it. */
export async function signAndFollow(
  approve: (relays: { relayId: string; draft: DelegateDraft }[]) => Promise<Approval[]>,
  relay: { relayId: string; draft: DelegateDraft },
  expected: ExpectedCall,
): Promise<RelayStatus> {
  await checkDraft(relay.draft, expected)
  const [approval] = await approve([relay])
  await api("/api/relay/sign", { body: approval })
  return followRelay(relay.relayId)
}
