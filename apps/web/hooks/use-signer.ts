"use client"

import type { DelegateDraft } from "@tegata/core/near"
import { useCallback } from "react"

import { approveWithWallet } from "@/lib/client/near-account"
import type { Approval } from "@/lib/client/sign-relay"

import { useNearKey } from "./use-near-key"
import { useProfile } from "./use-profile"

/**
 * Approve drafted gas-free actions as the signed-in person. Email sign-in signs each draft's hash with the key Privy
 * holds; a NEAR wallet signs them all as delegate actions in one prompt. Either way the server re-checks every one.
 */
export function useSigner() {
  const key = useNearKey()
  const { viaWallet, profile } = useProfile()
  const walletAccount = profile?.user.walletAccountId ?? null
  const walletNetwork = profile?.user.walletNetwork ?? "testnet"

  const approve = useCallback(
    async (relays: { relayId: string; draft: DelegateDraft }[]): Promise<Approval[]> => {
      if (viaWallet) {
        if (!walletAccount) throw new Error("Your wallet account isn't loaded yet")
        return approveWithWallet(walletNetwork, walletAccount, relays)
      }
      const approvals: Approval[] = []
      for (const relay of relays) {
        approvals.push({
          relayId: relay.relayId,
          signature: await key.sign(relay.draft.hash, relay.draft.publicKey),
        })
      }
      return approvals
    },
    [viaWallet, walletAccount, walletNetwork, key.sign],
  )

  return {
    ready: viaWallet ? Boolean(walletAccount) : key.ready,
    approve,
    /** The wallet opens to approve (the step reads "Approve in your wallet"). */
    viaWallet,
  }
}
