"use client"

import { usePrivy } from "@privy-io/react-auth"
import { useCreateWallet, useSignRawHash } from "@privy-io/react-auth/extended-chains"
import { base58 } from "@scure/base"
import { useCallback, useEffect } from "react"

/**
 * One wallet creation per page, shared by every component that asks: each of them sees no NEAR wallet until Privy
 * refreshes the user, and creating one per component gave some people several keys (only one opens their account).
 */
let creating: Promise<unknown> | null = null

/** A Privy NEAR wallet's address is its implicit account: the public key's 32 bytes as hex. */
const keyOfAddress = (address: string) =>
  `ed25519:${base58.encode(Uint8Array.from(address.match(/.{2}/g) ?? [], (b) => Number.parseInt(b, 16)))}`

/**
 * The person's NEAR signing key, held by Privy. Creates it the first time, and signs the 32-byte hash of a gas-free
 * action. The key itself never reaches our code.
 */
export function useNearKey() {
  const { ready, authenticated, user } = usePrivy()
  const { createWallet } = useCreateWallet()
  const { signRawHash } = useSignRawHash()

  const addresses = (user?.linkedAccounts ?? []).flatMap((account) =>
    account.type === "wallet" && account.chainType === "near" ? [account.address] : [],
  )
  const address = addresses[0]
  const addressList = addresses.join(",")

  useEffect(() => {
    if (!ready || !authenticated || !user || address || creating) return
    creating = createWallet({ chainType: "near" })
      .catch((error: unknown) => console.error("Could not create the signing key", error))
      .finally(() => {
        creating = null
      })
  }, [ready, authenticated, user, address, createWallet])

  /**
   * Sign a hex hash with the key the action names (the one the account was opened with, which the server put in the
   * draft); returns the signature as base64.
   */
  const sign = useCallback(
    async (hashHex: string, publicKey?: string): Promise<string> => {
      const all = addressList ? addressList.split(",") : []
      const signer = publicKey ? all.find((a) => keyOfAddress(a) === publicKey) : all[0]
      if (!signer) {
        throw new Error(
          all.length === 0
            ? "Your signing key is not ready yet"
            : "This sign-in doesn't hold your account's key. Sign out and in again.",
        )
      }
      const { signature } = await signRawHash({
        address: signer,
        chainType: "near",
        hash: `0x${hashHex}`,
      })
      const hex = signature.replace(/^0x/, "")
      const bytes = Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
      return btoa(String.fromCharCode(...bytes))
    },
    [addressList, signRawHash],
  )

  return { ready: ready && (!authenticated || Boolean(address)), address, sign }
}
