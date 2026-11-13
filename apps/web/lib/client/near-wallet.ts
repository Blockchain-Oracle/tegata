"use client"

/**
 * Paying from a NEAR wallet through NEAR Connect (`@hot-labs/near-connect`): HOT, Meteor, Intear, MyNearWallet… and
 * "Ethereum Wallets", where MetaMask signs for a `0x…` NEAR account. From our earlier Mamori
 * app. Every call is a single FunctionCall, which every wallet supports.
 */
import type { NearConnector } from "@hot-labs/near-connect"

/** Live is mainnet; Sandbox is testnet. */
export type NearNetwork = "mainnet" | "testnet"

const connectors = new Map<NearNetwork, Promise<NearConnector>>()

/** near-connect remembers the chosen wallet under fixed keys; keep testnet's apart. */
export const prefixedStorage = (prefix: string) => ({
  async get(key: string) {
    try {
      return localStorage.getItem(`${prefix}${key}`)
    } catch {
      return null
    }
  },
  async set(key: string, value: string) {
    try {
      localStorage.setItem(`${prefix}${key}`, value)
    } catch {
      // Storage blocked: the wallet asks again next time.
    }
  },
  async remove(key: string) {
    try {
      localStorage.removeItem(`${prefix}${key}`)
    } catch {
      // Nothing to remove.
    }
  },
})

function connector(network: NearNetwork = "mainnet"): Promise<NearConnector> {
  let existing = connectors.get(network)
  if (!existing) {
    existing = import("@hot-labs/near-connect").then(
      ({ NearConnector }) =>
        new NearConnector({
          network,
          features: { signAndSendTransaction: true },
          ...(network === "testnet" ? { storage: prefixedStorage("tegata-testnet:") } : {}),
        }),
    )
    connectors.set(network, existing)
  }
  return existing
}

type Wallet = Awaited<ReturnType<NearConnector["connect"]>>

export class WrongAccountError extends Error {
  override name = "WrongAccountError"
}

/** A wallet signed in as `accountId`, asking the user to connect if needed. */
async function walletFor(accountId: string, network: NearNetwork): Promise<Wallet> {
  const c = await connector(network)
  try {
    const { wallet, accounts } = await c.getConnectedWallet()
    if (accounts.some((a) => a.accountId === accountId)) return wallet
  } catch {
    // Nothing connected yet.
  }
  const wallet = await c.connect()
  const accounts = await wallet.getAccounts()
  if (!accounts.some((a) => a.accountId === accountId)) {
    throw new WrongAccountError(
      `The wallet is signed in as ${accounts[0]?.accountId ?? "another account"}. Switch it to ${accountId} and try again.`,
    )
  }
  return wallet
}

/** The NEAR account a wallet is signed in as, if any (no prompt). */
export async function connectedNearAccount(
  network: NearNetwork = "mainnet",
): Promise<string | null> {
  try {
    const { accounts } = await (await connector(network)).getConnectedWallet()
    return accounts[0]?.accountId ?? null
  } catch {
    return null
  }
}

/** Ask the user to pick a NEAR wallet (incl. MetaMask via Ethereum Wallets); returns its account. */
export async function connectNearAccount(network: NearNetwork = "mainnet"): Promise<string> {
  const wallet = await (await connector(network)).connect()
  const [account] = await wallet.getAccounts()
  if (!account) throw new Error("The wallet returned no account")
  return account.accountId
}

export async function disconnectNear(network: NearNetwork = "mainnet"): Promise<void> {
  await (await connector(network)).disconnect()
}

export interface FunctionCall {
  receiverId: string
  methodName: string
  args: Record<string, unknown>
  /** Gas in gas units. */
  gas: bigint
  /** yoctoNEAR attached. */
  deposit: bigint
}

/** Sign and send one function call as `accountId`; returns the tx hash. */
export async function sendCall(
  accountId: string,
  call: FunctionCall,
  network: NearNetwork = "mainnet",
): Promise<string> {
  const wallet = await walletFor(accountId, network)
  const result = await wallet.signAndSendTransaction({
    network,
    signerId: accountId,
    receiverId: call.receiverId,
    actions: [
      {
        type: "FunctionCall",
        params: {
          methodName: call.methodName,
          args: call.args,
          gas: call.gas.toString(),
          deposit: call.deposit.toString(),
        },
      },
    ],
  })
  const outcome = result as {
    transaction?: { hash?: string }
    transaction_outcome?: { id?: string }
  }
  const hash = outcome.transaction?.hash ?? outcome.transaction_outcome?.id
  if (!hash) throw new Error("The wallet did not return a transaction")
  assertSucceeded(result)
  return hash
}

/** A transaction can land and still fail inside the contract. */
function assertSucceeded(result: unknown) {
  const status = (result as { status?: unknown }).status
  if (status && typeof status === "object" && "Failure" in status) {
    const failure = JSON.stringify((status as { Failure: unknown }).Failure)
    throw new Error(`The transaction failed: ${failure.slice(0, 200)}`)
  }
}
