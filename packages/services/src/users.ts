import { NETWORKS, type NetworkId } from "@tegata/config"
import {
  accountExists,
  accountIdFor,
  handleProblem,
  isRegistered,
  type Operator,
} from "@tegata/core/near"
import { type Db, schema } from "@tegata/db"
import { and, eq } from "drizzle-orm"

import { walletAccountTaken, walletHandle } from "./wallet-auth.ts"

const { users, workspaces, accounts } = schema

export class OnboardError extends Error {
  constructor(
    readonly code:
      | "handle_invalid"
      | "handle_taken"
      | "already_onboarded"
      | "no_key"
      | "no_business"
      | "wrong_network",
    message: string,
  ) {
    super(message)
  }
}

/** Create or update the user after a verified Privy sign-in. The key comes from Privy, never the browser. */
export async function syncPrivyUser(
  db: Db,
  input: { privyId: string; email: string | null; publicKey: string | null },
) {
  const [existing] = await db.select().from(users).where(eq(users.privyId, input.privyId))
  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        email: input.email ?? existing.email,
        // A key is set once. If Privy ever reports a different one, keep the one accounts were made with.
        publicKey: existing.publicKey ?? input.publicKey,
      })
      .where(eq(users.id, existing.id))
      .returning()
    return updated ?? existing
  }
  const [created] = await db
    .insert(users)
    .values({ privyId: input.privyId, email: input.email, publicKey: input.publicKey })
    .returning()
  if (!created) throw new Error("Could not create the user")
  return created
}

/** Everything the app shell needs about the signed-in person. */
export async function getProfile(db: Db, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) return undefined
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.ownerId, userId))
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId))
  return { user, workspace, accounts: userAccounts }
}

/** Why a handle cannot be taken, or `null`. Checks the format, our database and the chain. */
export async function handleUnavailable(
  db: Db,
  handle: string,
  networks: readonly NetworkId[],
): Promise<string | null> {
  const problem = handleProblem(handle)
  if (problem) return problem
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.handle, handle))
  if (taken) return "Taken"
  for (const network of networks) {
    if (await accountExists(network, accountIdFor(network, handle))) return "Taken"
  }
  return null
}

/**
 * Name the business and claim the handle. Creates one account row per network; the worker
 * then creates the NEAR accounts.
 */
export async function onboard(
  db: Db,
  input: {
    userId: string
    handle: string
    businessName: string
    timezone: string
    networks: readonly NetworkId[]
  },
) {
  const [user] = await db.select().from(users).where(eq(users.id, input.userId))
  if (!user) throw new Error("No such user")
  if (!user.publicKey) throw new OnboardError("no_key", "Your signing key is not ready yet")
  if (user.handle) throw new OnboardError("already_onboarded", "This account is already set up")

  // Signed in with a NEAR wallet: the pay address is that account, on its own network, and the handle (only for the
  // join link) is made from its name. Otherwise the handle names a new `handle.tegata.testnet` on each network.
  const wallet = user.walletAccountId && user.walletNetwork
  let handle = input.handle
  let rows: { network: NetworkId; accountId: string }[]
  if (wallet) {
    const accountId = user.walletAccountId ?? ""
    const network = user.walletNetwork ?? "testnet"
    if (await walletAccountTaken(db, accountId, user.id)) {
      throw new OnboardError("handle_taken", `${accountId} is already used in Tegata`)
    }
    handle = await walletHandle(db, accountId)
    rows = [{ network, accountId }]
  } else {
    const problem = await handleUnavailable(db, input.handle, input.networks)
    if (problem) {
      throw new OnboardError(problem === "Taken" ? "handle_taken" : "handle_invalid", problem)
    }
    rows = input.networks.map((network) => ({ network, accountId: accountIdFor(network, handle) }))
  }

  return db.transaction(async (tx) => {
    await tx.update(users).set({ handle }).where(eq(users.id, user.id))
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        ownerId: user.id,
        name: input.businessName,
        timezone: input.timezone,
        email: user.email,
      })
      .returning()
    const created = await tx
      .insert(accounts)
      .values(rows.map((row) => ({ userId: user.id, ...row })))
      .returning()
    return { workspace, accounts: created }
  })
}

/**
 * Open the business's account on another network (the first time someone switches to Live). The same
 * handle on that network (`name.tegata.near`), or, for a NEAR-wallet user, their own account if it lives there. Returns
 * the row; the worker's account-setup job creates and registers it.
 */
export async function openNetworkAccount(db: Db, userId: string, network: NetworkId) {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user?.handle) throw new OnboardError("no_business", "Name your business first")
  const [existing] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.network, network)))
  if (existing) return existing
  let accountId: string
  if (user.walletAccountId) {
    if (user.walletNetwork !== network) {
      throw new OnboardError(
        "wrong_network",
        network === "mainnet"
          ? "Your wallet account is on testnet. Sign in with a mainnet NEAR wallet to use Live."
          : "Your wallet account is on mainnet. Sign in with a testnet wallet to use the Sandbox.",
      )
    }
    accountId = user.walletAccountId
  } else {
    accountId = accountIdFor(network, user.handle)
    const [taken] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.network, network), eq(accounts.accountId, accountId)))
    if (taken) throw new OnboardError("handle_taken", `${accountId} is already taken`)
  }
  const [row] = await db.insert(accounts).values({ userId, network, accountId }).returning()
  if (!row) throw new Error("Could not open the account")
  return row
}

/**
 * Make one account ready to hold dollars: create it on chain with the user's key, then
 * register it on USDC. Each step is skipped when the chain says it is already done, so the
 * job can run any number of times.
 */
export async function setupAccount(db: Db, operator: Operator, accountRowId: string) {
  const [row] = await db.select().from(accounts).where(eq(accounts.id, accountRowId))
  if (!row || row.readyAt) return row
  const [user] = await db.select().from(users).where(eq(users.id, row.userId))
  if (!user?.publicKey) throw new Error(`User ${row.userId} has no key`)
  const network = operator.network
  if (row.network !== network) throw new Error("Wrong operator for this account")

  let createdTx = row.createdTx
  if (!(await accountExists(network, row.accountId))) {
    // A wallet's own account always exists (its key signed in); Tegata never creates one in its name.
    if (user.walletAccountId) throw new Error(`${row.accountId} doesn't exist on ${network}`)
    const created = await operator.createUserAccount(row.accountId, user.publicKey, 0n)
    if (created.status !== "success") {
      throw new Error(`Creating ${row.accountId} failed: ${created.error ?? created.status}`)
    }
    createdTx = created.hash
    await db.update(accounts).set({ createdTx }).where(eq(accounts.id, row.id))
  }

  let registeredTx = row.registeredTx
  if (!(await isRegistered(network, usdcOf(operator), row.accountId))) {
    const registered = await operator.registerOnUsdc(row.accountId)
    if (registered.status !== "success") {
      throw new Error(
        `Registering ${row.accountId} failed: ${registered.error ?? registered.status}`,
      )
    }
    registeredTx = registered.hash
  }

  const [ready] = await db
    .update(accounts)
    .set({ createdTx, registeredTx, readyAt: new Date() })
    .where(eq(accounts.id, row.id))
    .returning()
  return ready
}

const usdcOf = (operator: Operator) => NETWORKS[operator.network].usdc

/** Accounts a worker should finish setting up when it starts. */
export async function accountsNotReady(db: Db) {
  const rows = await db.select().from(accounts)
  return rows.filter((row) => !row.readyAt)
}

export async function accountFor(db: Db, userId: string, network: NetworkId) {
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.network, network)))
  return row
}
