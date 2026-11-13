// The Gnosis chain, read only: a Gnosis Pay card account's balances (USDC.e and EURe, the coins its card spends).
// NEAR Intents delivers both tokens on Gnosis, so a card is topped up by the same payout engine as any other chain.

export const GNOSIS_RPC = "https://rpc.gnosischain.com"
export const GNOSIS_TOKENS = {
  /** USDC.e on Gnosis: the same contract 1Click delivers (`nep141:gnosis-0x2a22…omft.near`). */
  usdc: { address: "0x2a22f9c3b484c3629090feed35f17ff8f88f76f0", decimals: 6, symbol: "USDC" },
  eure: { address: "0x420ca0f9b9b604ce0fd9c18ef134c705e5fa3430", decimals: 18, symbol: "EURe" },
} as const

const ADDRESS = /^0x[0-9a-fA-F]{40}$/
export const isGnosisAddress = (value: string) => ADDRESS.test(value.trim())

async function balanceOf(token: string, owner: string): Promise<bigint> {
  // balanceOf(address): selector 0x70a08231 and the owner left-padded to 32 bytes.
  const data = `0x70a08231${owner.slice(2).toLowerCase().padStart(64, "0")}`
  const response = await fetch(GNOSIS_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: token, data }, "latest"],
    }),
    cache: "no-store",
  })
  const body = (await response.json()) as { result?: string; error?: { message: string } }
  if (!body.result) throw new Error(body.error?.message ?? "Gnosis didn't answer")
  return BigInt(body.result === "0x" ? 0 : body.result)
}

const format = (units: bigint, decimals: number) => {
  const scale = 10n ** BigInt(decimals)
  const cents = (units * 100n) / scale
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`
}

/** What a card account holds, to two decimals. */
export async function cardBalances(account: string) {
  if (!isGnosisAddress(account)) throw new Error("That isn't a Gnosis address")
  const [usdc, eure] = await Promise.all([
    balanceOf(GNOSIS_TOKENS.usdc.address, account),
    balanceOf(GNOSIS_TOKENS.eure.address, account),
  ])
  return { usdc: format(usdc, 6), eure: format(eure, 18) }
}
