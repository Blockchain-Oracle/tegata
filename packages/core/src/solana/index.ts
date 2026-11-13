// Tegata's own Solana wallet, server only (the worker): in the Sandbox it stands in for NEAR Intents' hop and hands
// Noah's test USDC to Noah's deposit address on Solana devnet (NEAR Intents has no testnet). One SPL `transferChecked`,
// with the recipient's token account created first if it has none (idempotent).

import {
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getBase58Encoder,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit"
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getTransferCheckedInstruction,
} from "@solana-program/token"

export const SOLANA_DEVNET = {
  rpc: "https://api.devnet.solana.com",
  ws: "wss://api.devnet.solana.com",
  explorer: (signature: string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
} as const

/** Lamports per SOL; a token transfer plus an account creation costs well under 0.003 SOL. */
const MIN_FEE_LAMPORTS = 3_000_000n

export class SolanaError extends Error {}

async function wallet(secret: string) {
  return createKeyPairSignerFromBytes(getBase58Encoder().encode(secret))
}

/** The wallet's SOL (for fees), and its fullest token account for `mint` (Noah may not use the standard one). */
export async function walletBalances(secret: string, mint: string) {
  const rpc = createSolanaRpc(SOLANA_DEVNET.rpc)
  const signer = await wallet(secret)
  const [{ value: lamports }, { value: accounts }] = await Promise.all([
    rpc.getBalance(signer.address).send(),
    rpc
      .getTokenAccountsByOwner(signer.address, { mint: address(mint) }, { encoding: "jsonParsed" })
      .send(),
  ])
  const fullest = accounts
    .map((a) => ({
      pubkey: a.pubkey,
      amount: BigInt(
        (a.account.data as { parsed: { info: { tokenAmount: { amount: string } } } }).parsed.info
          .tokenAmount.amount,
      ),
    }))
    .sort((x, y) => (y.amount > x.amount ? 1 : -1))[0]
  return {
    address: signer.address as string,
    lamports,
    token: fullest?.amount ?? 0n,
    tokenAccount: fullest?.pubkey ?? null,
  }
}

/** Send `amount` base units of `mint` from the wallet to `to`. Returns the transaction signature once confirmed. */
export async function sendToken(input: {
  secret: string
  mint: string
  decimals: number
  to: string
  amount: bigint
}): Promise<string> {
  const rpc = createSolanaRpc(SOLANA_DEVNET.rpc)
  const rpcSubscriptions = createSolanaRpcSubscriptions(SOLANA_DEVNET.ws)
  const signer = await wallet(input.secret)
  const balances = await walletBalances(input.secret, input.mint)
  if (balances.lamports < MIN_FEE_LAMPORTS)
    throw new SolanaError("Tegata's Solana test wallet needs devnet SOL for fees")
  if (balances.token < input.amount)
    throw new SolanaError("Tegata's Solana test wallet doesn't hold enough test USDC")
  const mint = address(input.mint)
  const owner = address(input.to)
  const source = balances.tokenAccount
  if (!source) throw new SolanaError("Tegata's Solana test wallet has no test USDC account")
  // The mint's owner is its token program: classic SPL Token or Token-2022 (Noah's test USDC is Token-2022). The
  // account derivation, the account creation and the transfer all go to that program.
  const { value: mintAccount } = await rpc.getAccountInfo(mint, { encoding: "base64" }).send()
  if (!mintAccount) throw new SolanaError("That token doesn't exist on Solana devnet")
  const tokenProgram = mintAccount.owner
  const [destination] = await findAssociatedTokenPda({ mint, owner, tokenProgram })
  const create = await getCreateAssociatedTokenIdempotentInstructionAsync({
    payer: signer,
    owner,
    mint,
    tokenProgram,
  })
  const transfer = getTransferCheckedInstruction(
    {
      source: address(source),
      mint,
      destination,
      authority: signer,
      amount: input.amount,
      decimals: input.decimals,
    },
    { programAddress: tokenProgram },
  )
  const { value: blockhash } = await rpc.getLatestBlockhash().send()
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions([create, transfer], m),
  )
  const signed = await signTransactionMessageWithSigners(message)
  assertIsTransactionWithBlockhashLifetime(signed)
  await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(signed, {
    commitment: "confirmed",
  })
  return getSignatureFromTransaction(signed)
}
