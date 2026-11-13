"use client"

// "Pay with MetaMask": the payer's own wallet on the chosen chain, found on this device (EIP-6963 for EVM wallets,
// TronLink for Tron), each with its own icon. Connecting fills the refund address with the wallet's address and gets
// the NEAR Intents deposit address; the deposit panel then asks the wallet to send the exact amount there.
import { ChevronRight, WalletMinimal } from "lucide-react"
import { useEffect, useState } from "react"

import { Mark } from "@/components/marks/mark"
import type { PayWallet } from "@/lib/client/chain-wallets"
import { fire } from "@/lib/feedback"

/** The wallet the payer chose, so the deposit panel offers the same one (kept for this tab). */
export const PAY_WALLET_KEY = "tegata.payWallet"

export function WalletIcon({ wallet, size = 28 }: { wallet: PayWallet; size?: number }) {
  if (wallet.icon)
    return (
      <img
        src={wallet.icon}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-[8px]"
        style={{ width: size, height: size }}
      />
    )
  if (wallet.family === "tron") return <Mark id="tron" size={size} />
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[8px] bg-secondary"
      style={{ width: size, height: size }}
    >
      <WalletMinimal className="size-4" />
    </span>
  )
}

/** The wallets on this device for a chain, found once per chain. */
export function useChainWallets(chainMark: string | null | undefined) {
  const [wallets, setWallets] = useState<PayWallet[] | null>(null)
  useEffect(() => {
    let live = true
    setWallets(null)
    void import("@/lib/client/chain-wallets")
      .then((m) => m.walletsFor(chainMark))
      .then((found) => {
        if (live) setWallets(found)
      })
      .catch(() => {
        if (live) setWallets([])
      })
    return () => {
      live = false
    }
  }, [chainMark])
  return wallets
}

export function WalletRows({
  chainMark,
  disabled,
  onConnected,
}: {
  chainMark: string
  disabled: boolean
  onConnected: (address: string) => void
}) {
  const wallets = useChainWallets(chainMark)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  if (!wallets?.length) return null

  const connect = async (wallet: PayWallet) => {
    setBusy(wallet.id)
    setProblem(null)
    try {
      const { connectWallet } = await import("@/lib/client/chain-wallets")
      const address = await connectWallet(wallet)
      try {
        sessionStorage.setItem(PAY_WALLET_KEY, wallet.id)
      } catch {
        // Private windows: the deposit panel offers the first wallet instead.
      }
      fire("tick", { cue: "confirmed" })
      onConnected(address)
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(error instanceof Error ? error.message : "The wallet didn't answer")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {wallets.slice(0, 3).map((wallet) => (
        <button
          key={wallet.id}
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => void connect(wallet)}
          className="press flex items-center gap-3 rounded-[14px] bg-card px-4 py-3 text-left shadow-[0_0_0_1px_var(--border)] disabled:opacity-50"
        >
          <WalletIcon wallet={wallet} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold">Pay with {wallet.name}</span>
            <span className="text-detail text-muted-foreground">
              Connect, then approve one transfer
            </span>
          </span>
          {busy === wallet.id ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <ChevronRight className="size-4 text-text-3" />
          )}
        </button>
      ))}
      {problem ? <p className="text-[14px] font-medium text-down">{problem}</p> : null}
      <span className="text-center text-detail text-muted-foreground">
        or send from any wallet or exchange
      </span>
    </div>
  )
}
