"use client"

// Pay to another chain (plan 6.8 AB, payroll): pick the coin and chain from real marks, then paste the address there.
// The address is checked for that chain's format as it's typed. Live only: NEAR Intents has no testnet.
import { Check } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Mark } from "@/components/marks/mark"
import { ADDRESS_HINT, addressLooksRight, PAYER_ROUTES } from "@/lib/routes"
import { cn } from "@/lib/utils"

export function ChainPicker({
  busy,
  onPick,
  initial,
}: {
  busy: boolean
  onPick: (choice: { route: string; address: string }) => void
  initial?: { route?: string | null; address?: string | null }
}) {
  const [route, setRoute] = useState(initial?.route ?? "usdc-base")
  const [address, setAddress] = useState(initial?.address ?? "")
  const found = PAYER_ROUTES.find((r) => r.id === route)
  const ok = Boolean(found && addressLooksRight(found.chainMark, address))
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (ok && found) onPick({ route, address: address.trim() })
      }}
    >
      <div
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        role="radiogroup"
        aria-label="Coin and chain"
      >
        {PAYER_ROUTES.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={route === r.id}
            onClick={() => setRoute(r.id)}
            className={cn(
              "press relative flex flex-col items-center gap-1.5 rounded-[14px] bg-card px-2 py-3 text-center shadow-[0_0_0_1px_var(--border)]",
              route === r.id && "shadow-[0_0_0_2px_var(--shu)]",
            )}
          >
            <Mark id={r.coin} chain={r.chainMark} size={32} />
            <span className="text-[13px] leading-tight font-semibold">{r.symbol}</span>
            <span className="text-[12px] leading-tight text-muted-foreground">{r.chain}</span>
            {route === r.id ? (
              <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-shu text-white">
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <Field
        id="chain-address"
        label={found ? `Address on ${found.chain}` : "Address"}
        placeholder={found ? (ADDRESS_HINT[found.chainMark] ?? "Address") : "Address"}
        value={address}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="none"
        className="font-mono"
        leading={found ? <Mark id={found.chainMark} size={22} /> : null}
        onChange={(e) => setAddress(e.target.value.trim())}
        status={
          address && !ok && found
            ? { kind: "bad", text: `That doesn't look like a ${found.chain} address` }
            : { kind: "none" }
        }
      />
      <Button type="submit" size="md" busy={busy} disabled={!ok}>
        {found ? `Get paid in ${found.symbol} on ${found.chain}` : "Use this address"}
      </Button>
    </form>
  )
}
