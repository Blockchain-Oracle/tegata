"use client"

import { usePrivy } from "@privy-io/react-auth"
import { useCreateWallet, useSignRawHash } from "@privy-io/react-auth/extended-chains"
import { useCallback, useEffect, useRef } from "react"

/**
 * The person's NEAR signing key, held by Privy. Creates it the first time, and signs the
 * 32-byte hash of a gas-free action. The key itself never reaches our code.
 */
export function useNearKey() {
  const { ready, authenticated, user } = usePrivy()
  const { createWallet } = useCreateWallet()
  const { signRawHash } = useSignRawHash()
  const creating = useRef(false)

  const wallet = user?.linkedAccounts.find(
    (account) => account.type === "wallet" && account.chainType === "near",
  )
  const address = wallet?.type === "wallet" ? wallet.address : undefined

  useEffect(() => {
    if (!ready || !authenticated || !user || address || creating.current) return
    creating.current = true
    createWallet({ chainType: "near" })
      .catch((error: unknown) => console.error("Could not create the signing key", error))
      .finally(() => {
        creating.current = false
      })
  }, [ready, authenticated, user, address, createWallet])

  /** Sign a hex hash; returns the signature as base64. */
  const sign = useCallback(
    async (hashHex: string): Promise<string> => {
      if (!address) throw new Error("Your signing key is not ready yet")
      const { signature } = await signRawHash({
        address,
        chainType: "near",
        hash: `0x${hashHex}`,
      })
      const hex = signature.replace(/^0x/, "")
      const bytes = Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
      return btoa(String.fromCharCode(...bytes))
    },
    [address, signRawHash],
  )

  return { ready: ready && (!authenticated || Boolean(address)), address, sign }
}
