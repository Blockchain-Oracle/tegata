// Sign in with a NEAR wallet. The server hands out a one-time NEP-413 nonce; the wallet signs "Sign in
// to Tegata" with it; the server checks the signature and that the key has full access to the account, then the
// person is that account. Their pay address is the wallet's own account: Tegata creates nothing, only registers it on
// USDC if it can't hold dollars yet.
import { randomBytes } from "node:crypto"

import { LIMITS, type NetworkId, RESERVED_HANDLES } from "@tegata/config"
import {
  handleProblem,
  isTegataAccount,
  SIGN_IN_MESSAGE,
  SIGN_IN_RECIPIENT,
  suggestHandle,
  verifySignIn,
  walletAccountNetwork,
  walletBytes,
} from "@tegata/core/near"
import { type Db, schema } from "@tegata/db"
import { and, eq, gt, isNull } from "drizzle-orm"

const { users, accounts, signInChallenges } = schema

const CHALLENGE_TTL_MS = 5 * 60_000
const NONCE_BYTES = 32
const HANDLE_TRIES = 50

export class WalletSignInError extends Error {
  constructor(
    readonly code: "expired" | "wrong_network" | "bad_signature" | "tegata_account",
    message: string,
  ) {
    super(message)
  }
}

/** A fresh sign-in request for the wallet to sign. */
export async function createSignInChallenge(db: Db, network: NetworkId) {
  const nonce = randomBytes(NONCE_BYTES).toString("base64")
  await db
    .insert(signInChallenges)
    .values({ nonce, network, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) })
  return { message: SIGN_IN_MESSAGE, recipient: SIGN_IN_RECIPIENT, nonce, network }
}

/**
 * Check a wallet's signed sign-in and return the person it proves. The nonce is spent first, so one signature signs
 * in once. A Tegata account (`name.tegata.testnet`) is refused: only its email sign-in controls it.
 */
export async function signInWithWallet(
  db: Db,
  input: {
    network: NetworkId
    accountId: string
    publicKey: string
    signature: string
    nonce: string
  },
) {
  const accountId = input.accountId.trim().toLowerCase()
  const named = walletAccountNetwork(accountId)
  if (named && named !== input.network) {
    throw new WalletSignInError(
      "wrong_network",
      named === "mainnet"
        ? "That's a mainnet account. The Sandbox runs on NEAR testnet: switch your wallet to testnet."
        : "That's a testnet account. Live runs on NEAR mainnet: switch your wallet to mainnet.",
    )
  }
  if (isTegataAccount(accountId)) {
    throw new WalletSignInError(
      "tegata_account",
      "That's a Tegata account. Sign in with the email it was opened with.",
    )
  }
  const [challenge] = await db
    .update(signInChallenges)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(signInChallenges.nonce, input.nonce),
        eq(signInChallenges.network, input.network),
        isNull(signInChallenges.usedAt),
        gt(signInChallenges.expiresAt, new Date()),
      ),
    )
    .returning()
  if (!challenge) {
    throw new WalletSignInError("expired", "That sign-in request has expired. Try again.")
  }
  try {
    await verifySignIn({
      network: input.network,
      accountId,
      publicKey: input.publicKey,
      signature: input.signature,
      nonce: walletBytes(input.nonce),
    })
  } catch {
    throw new WalletSignInError(
      "bad_signature",
      "Your wallet's signature didn't check out. Try again.",
    )
  }

  const [existing] = await db.select().from(users).where(eq(users.walletAccountId, accountId))
  if (existing) {
    // The key that signed in last is the one drafts are made for; the wallet may sign actions with any of its keys.
    const [updated] = await db
      .update(users)
      .set({ publicKey: input.publicKey })
      .where(eq(users.id, existing.id))
      .returning()
    return updated ?? existing
  }
  const [created] = await db
    .insert(users)
    .values({
      walletAccountId: accountId,
      walletNetwork: input.network,
      publicKey: input.publicKey,
    })
    .returning()
  if (!created) throw new Error("Could not create the user")
  return created
}

/** A free handle (for the join link) from a wallet account's first label: `abu.testnet` → `abu`, then `abu-2`… */
export async function walletHandle(db: Db, accountId: string): Promise<string> {
  const label = accountId.includes(".") ? (accountId.split(".")[0] ?? "") : accountId.slice(0, 12)
  let base = suggestHandle(label).slice(0, LIMITS.handleMaxLength - 3)
  if (handleProblem(base) || RESERVED_HANDLES.includes(base)) base = `near-${base}`.slice(0, 20)
  if (handleProblem(base)) base = "near-business"
  for (let i = 1; i <= HANDLE_TRIES; i++) {
    const handle = i === 1 ? base : `${base}-${i}`
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.handle, handle))
    if (!taken && !handleProblem(handle)) return handle
  }
  return `${base}-${randomBytes(3).toString("hex")}`
}

/** True when this account already belongs to someone else in Tegata (an email account, or a person's destination). */
export async function walletAccountTaken(db: Db, accountId: string, userId: string) {
  const [row] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.accountId, accountId))
  return Boolean(row && row.userId !== userId)
}
