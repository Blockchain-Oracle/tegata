"use client"

// The payer's own wallet on another chain, for the pay page's "Another chain" rail. No SDK: EVM wallets announce
// themselves through EIP-6963 (MetaMask, Rabby, Coinbase Wallet, OKX…), and TronLink injects `tronWeb`. The wallet
// sends one transfer of exactly the quote's `amountIn` to the NEAR Intents deposit address; NEAR Intents converts it
// and the business receives exact USDC on NEAR. Nothing here decides "paid": the server reads that from NEAR.

/** The EVM chains a route can be on, by its mark, with what a wallet needs to add one it doesn't know yet. */
const EVM_CHAINS: Record<
  string,
  { id: number; name: string; currency: string; rpc: string; explorer: string }
> = {
  eth: {
    id: 1,
    name: "Ethereum",
    currency: "ETH",
    rpc: "https://eth.llamarpc.com",
    explorer: "https://etherscan.io",
  },
  base: {
    id: 8453,
    name: "Base",
    currency: "ETH",
    rpc: "https://mainnet.base.org",
    explorer: "https://basescan.org",
  },
  arb: {
    id: 42161,
    name: "Arbitrum One",
    currency: "ETH",
    rpc: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
  },
  pol: {
    id: 137,
    name: "Polygon",
    currency: "POL",
    rpc: "https://polygon-rpc.com",
    explorer: "https://polygonscan.com",
  },
  bnb: {
    id: 56,
    name: "BNB Smart Chain",
    currency: "BNB",
    rpc: "https://bsc-dataseed.binance.org",
    explorer: "https://bscscan.com",
  },
  gnosis: {
    id: 100,
    name: "Gnosis",
    currency: "xDAI",
    rpc: "https://rpc.gnosischain.com",
    explorer: "https://gnosisscan.io",
  },
  avax: {
    id: 43114,
    name: "Avalanche C-Chain",
    currency: "AVAX",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    explorer: "https://snowtrace.io",
  },
}

interface Eip1193 {
  request(args: { method: string; params?: unknown }): Promise<unknown>
  isMetaMask?: boolean
}

interface TronWeb {
  defaultAddress?: { base58?: string | false }
  transactionBuilder: {
    triggerSmartContract(
      contract: string,
      fn: string,
      options: { feeLimit: number },
      params: { type: string; value: string }[],
      from: string,
    ): Promise<{ transaction: unknown; result?: { result?: boolean } }>
  }
  trx: {
    sign(transaction: unknown): Promise<unknown>
    sendRawTransaction(
      signed: unknown,
    ): Promise<{ result?: boolean; txid?: string; transaction?: { txID?: string } }>
  }
}

declare global {
  interface Window {
    tronLink?: { request(args: { method: string }): Promise<unknown>; tronWeb?: TronWeb }
    tronWeb?: TronWeb
  }
}

export interface PayWallet {
  /** EIP-6963 rdns ("io.metamask"), or "tronlink". */
  id: string
  name: string
  /** The wallet's own icon, a data: URL it announced (never a remote URL). */
  icon: string | null
  family: "evm" | "tron"
}

/** A wallet that refused, so the page can say "Nothing was sent". */
export class WalletRejected extends Error {}

const evmProviders = new Map<string, Eip1193>()

/** Whether this route's chain can be paid from a wallet on the page. */
export const walletChain = (chainMark: string | null | undefined): "evm" | "tron" | null =>
  chainMark && EVM_CHAINS[chainMark] ? "evm" : chainMark === "tron" ? "tron" : null

/** The wallets on this device for a chain: EVM wallets that announce themselves, or TronLink. */
export async function walletsFor(chainMark: string | null | undefined): Promise<PayWallet[]> {
  if (typeof window === "undefined") return []
  const family = walletChain(chainMark)
  if (family === "tron")
    return window.tronLink || window.tronWeb
      ? [{ id: "tronlink", name: "TronLink", icon: null, family: "tron" }]
      : []
  if (family !== "evm") return []
  const found = await new Promise<PayWallet[]>((resolve) => {
    const seen = new Map<string, PayWallet>()
    const announce = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          info?: { uuid?: string; name?: string; icon?: string; rdns?: string }
          provider?: Eip1193
        }>
      ).detail
      const id = detail?.info?.rdns || detail?.info?.uuid
      if (!id || !detail?.provider || !detail.info?.name) return
      evmProviders.set(id, detail.provider)
      const icon = detail.info.icon?.startsWith("data:image/") ? detail.info.icon : null
      seen.set(id, { id, name: detail.info.name, icon, family: "evm" })
    }
    window.addEventListener("eip6963:announceProvider", announce)
    window.dispatchEvent(new Event("eip6963:requestProvider"))
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", announce)
      resolve([...seen.values()])
    }, 300)
  })
  // A wallet too old for EIP-6963 still injects window.ethereum.
  const injected = (window as unknown as { ethereum?: Eip1193 }).ethereum
  if (!found.length && injected) {
    evmProviders.set("injected", injected)
    found.push({
      id: "injected",
      name: injected.isMetaMask ? "MetaMask" : "your wallet",
      icon: null,
      family: "evm",
    })
  }
  return found
}

const rejected = (error: unknown) => {
  const code = (error as { code?: number })?.code
  const message = String((error as { message?: string })?.message ?? error).toLowerCase()
  return code === 4001 || message.includes("reject") || message.includes("denied")
}

function tronWeb(): TronWeb | null {
  return window.tronLink?.tronWeb ?? window.tronWeb ?? null
}

/** Ask the wallet for its address on this chain (the payer's refund address). */
export async function connectWallet(wallet: PayWallet): Promise<string> {
  try {
    if (wallet.family === "tron") {
      await window.tronLink?.request({ method: "tron_requestAccounts" })
      const address = tronWeb()?.defaultAddress?.base58
      if (!address) throw new Error("Open TronLink and unlock it, then try again")
      return address
    }
    const provider = evmProviders.get(wallet.id)
    if (!provider) throw new Error("That wallet isn't available any more")
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[]
    const address = accounts[0]
    if (!address) throw new Error("The wallet didn't share an address")
    return address
  } catch (error) {
    if (rejected(error)) throw new WalletRejected("Nothing was shared or sent")
    throw error
  }
}

const hex = (value: bigint) => `0x${value.toString(16)}`
const word = (hexValue: string) => hexValue.replace(/^0x/, "").toLowerCase().padStart(64, "0")

/** ERC-20 `transfer(to, amount)` call data. */
const transferData = (to: string, amount: bigint) =>
  `0xa9059cbb${word(to)}${word(amount.toString(16))}`

async function onChain(provider: Eip1193, chainMark: string) {
  const chain = EVM_CHAINS[chainMark]
  if (!chain) throw new Error("This chain can't be paid from a wallet here")
  const current = (await provider.request({ method: "eth_chainId" })) as string
  if (Number.parseInt(current, 16) === chain.id) return
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hex(BigInt(chain.id)) }],
    })
  } catch (error) {
    if ((error as { code?: number })?.code !== 4902) throw error
    // The wallet doesn't know this chain yet: add it, then it's selected.
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hex(BigInt(chain.id)),
          chainName: chain.name,
          nativeCurrency: { name: chain.currency, symbol: chain.currency, decimals: 18 },
          rpcUrls: [chain.rpc],
          blockExplorerUrls: [chain.explorer],
        },
      ],
    })
  }
}

/**
 * Send exactly `amount` (the coin's base units) to the deposit address from the payer's wallet: an ERC-20 or TRC-20
 * transfer, or the chain's own coin when there's no token contract. Returns the transaction hash.
 */
export async function sendFromWallet(
  wallet: PayWallet,
  input: { chainMark: string; contract: string | null; to: string; amount: bigint },
): Promise<string> {
  try {
    if (wallet.family === "tron") {
      const tw = tronWeb()
      const from = tw?.defaultAddress?.base58
      if (!tw || !from) throw new Error("Open TronLink and unlock it, then try again")
      if (!input.contract) throw new Error("Only USDT on Tron can be sent from TronLink here")
      const built = await tw.transactionBuilder.triggerSmartContract(
        input.contract,
        "transfer(address,uint256)",
        { feeLimit: 100_000_000 },
        [
          { type: "address", value: input.to },
          { type: "uint256", value: input.amount.toString() },
        ],
        from,
      )
      const signed = await tw.trx.sign(built.transaction)
      const sent = await tw.trx.sendRawTransaction(signed)
      const id = sent.txid ?? sent.transaction?.txID
      if (!sent.result || !id) throw new Error("TronLink didn't send it. Nothing moved.")
      return id
    }
    const provider = evmProviders.get(wallet.id)
    if (!provider) throw new Error("That wallet isn't available any more")
    const [from] = (await provider.request({ method: "eth_requestAccounts" })) as string[]
    await onChain(provider, input.chainMark)
    const tx = input.contract
      ? { from, to: input.contract, data: transferData(input.to, input.amount) }
      : { from, to: input.to, value: hex(input.amount) }
    return (await provider.request({ method: "eth_sendTransaction", params: [tx] })) as string
  } catch (error) {
    if (rejected(error)) throw new WalletRejected("Nothing was sent")
    throw error
  }
}
