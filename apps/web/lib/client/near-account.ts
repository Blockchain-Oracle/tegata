"use client"

import type { NearConnector } from "@hot-labs/near-connect"
/**
 * Signing in with a NEAR wallet, and approving gas-free actions with it. Its own NEAR Connect instance,
 * kept apart from the one payers use: it offers only wallets that can both sign a message at sign-in and sign delegate
 * actions (HOT, Meteor, Intear, Ledger…), so every wallet offered here can also approve Tegata's actions.
 */
import type { DelegateDraft } from "@tegata/core/near"

import type { Profile } from "@/lib/client/types"
import { type NearNetwork, prefixedStorage } from "./near-wallet"

const connectors = new Map<NearNetwork, Promise<NearConnector>>()

function accountConnector(network: NearNetwork): Promise<NearConnector> {
  let existing = connectors.get(network)
  if (!existing) {
    existing = import("@hot-labs/near-connect").then(
      ({ NearConnector }) =>
        new NearConnector({
          network,
          features: { signInAndSignMessage: true, signDelegateActions: true },
          storage: prefixedStorage(`tegata-account-${network}:`),
        }),
    )
    connectors.set(network, existing)
  }
  return existing
}

/** The page's hint that this browser signed in with a wallet. The httpOnly session cookie is the real proof. */
export function hasWalletSession(): boolean {
  return typeof document !== "undefined" && /(?:^|;\s*)tegata-wallet=1/.test(document.cookie)
}

export function forgetWalletSession(): void {
  // biome-ignore lint/suspicious/noDocumentCookie: one fixed flag, cleared synchronously before the redirect to sign-in.
  document.cookie = "tegata-wallet=; Max-Age=0; Path=/; SameSite=Lax"
}

export class WalletSignInError extends Error {
  override name = "WalletSignInError"
}

async function json<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T & { error?: { message: string } }
  if (!response.ok)
    throw new WalletSignInError(data?.error?.message ?? "Couldn't sign in. Try again.")
  return data
}

/**
 * One wallet prompt: pick a wallet, connect, and sign "Sign in to Tegata" with a nonce from the server. The server
 * checks it and sets the session; returns the profile.
 */
export async function signInWithNearWallet(network: NearNetwork): Promise<Profile> {
  const challenge = await json<{ message: string; recipient: string; nonce: string }>(
    await fetch("/api/wallet/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ network }),
    }),
  )
  const c = await accountConnector(network)
  let signed:
    | { accountId: string; signedMessage: { publicKey: string; signature: string } }
    | undefined
  c.on("wallet:signInAndSignMessage", (event) => {
    signed = event.accounts[0]
  })
  const nonce = Uint8Array.from(atob(challenge.nonce), (ch) => ch.charCodeAt(0))
  await c.connect({
    signMessageParams: { message: challenge.message, recipient: challenge.recipient, nonce },
  })
  if (!signed) throw new WalletSignInError("The wallet didn't sign. Nothing was signed in.")
  return json<Profile>(
    await fetch("/api/wallet/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        network,
        accountId: signed.accountId,
        publicKey: signed.signedMessage.publicKey,
        signature: signed.signedMessage.signature,
        nonce: challenge.nonce,
      }),
    }),
  )
}

export async function signOutNearWallet(network: NearNetwork): Promise<void> {
  await fetch("/api/wallet/session", { method: "DELETE" }).catch(() => undefined)
  forgetWalletSession()
  await (await accountConnector(network)).disconnect().catch(() => undefined)
}

/**
 * Approve drafted actions with the wallet in one prompt: it signs each as a delegate action, which Tegata relays and
 * pays for. The server checks every one is exactly its draft before anything is sent.
 */
export async function approveWithWallet(
  network: NearNetwork,
  accountId: string,
  relays: { relayId: string; draft: DelegateDraft }[],
): Promise<{ relayId: string; signedDelegate: string }[]> {
  const c = await accountConnector(network)
  let wallet: Awaited<ReturnType<NearConnector["connect"]>>
  try {
    const connected = await c.getConnectedWallet()
    if (!connected.accounts.some((a) => a.accountId === accountId)) throw new Error("other account")
    wallet = connected.wallet
  } catch {
    wallet = await c.connect()
    const accounts = await wallet.getAccounts()
    if (!accounts.some((a) => a.accountId === accountId)) {
      throw new WalletSignInError(
        `The wallet is signed in as ${accounts[0]?.accountId ?? "another account"}. Switch it to ${accountId}.`,
      )
    }
  }
  const { signedDelegateActions } = await wallet.signDelegateActions({
    network,
    signerId: accountId,
    delegateActions: relays.map(({ draft }) => ({
      receiverId: draft.receiverId,
      actions: draft.calls.map((call) => ({
        type: "FunctionCall" as const,
        params: {
          methodName: call.method,
          args: JSON.parse(call.argsJson) as Record<string, unknown>,
          gas: call.gas,
          deposit: call.deposit,
        },
      })),
    })),
  })
  if (signedDelegateActions.length !== relays.length)
    throw new WalletSignInError("The wallet didn't approve every step. Nothing moved.")
  return relays.map((relay, i) => ({
    relayId: relay.relayId,
    signedDelegate: signedDelegateActions[i] ?? "",
  }))
}
