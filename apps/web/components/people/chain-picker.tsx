"use client"

// Pay to another chain (payroll): pick the coin, then the chain, from real marks; then paste the address there.
// The address is checked for that chain's format as it's typed. Live only: NEAR Intents has no testnet.
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Mark } from "@/components/marks/mark"
import { RoutePicker } from "@/components/pay/route-picker"
import { ADDRESS_HINT, addressLooksRight, PAYER_ROUTES } from "@/lib/routes"

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
      <RoutePicker routes={PAYER_ROUTES} value={route} onChange={setRoute} tone="card" />
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
