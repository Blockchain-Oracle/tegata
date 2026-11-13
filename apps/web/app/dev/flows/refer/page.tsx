"use client"

// Referrals in every state: the Refer page (none yet, a mix of joined / qualifying / paid / not counted,
// loading, error) and the join page a friend opens, on sample data that lives only under /dev.
import { useState } from "react"

import { Segmented } from "@/components/kit/segmented"
import { ReferView } from "@/components/referrals/refer-view"
import type { ReferralRow, ReferralsView } from "@/lib/client/types"
import { SAMPLE_BUSINESS } from "@/lib/dev/sample"

import { JoinView } from "../../../join/[handle]/join-view"

type State = "mix" | "empty" | "loading" | "error"

const at = (ms: number) => new Date(Date.now() + ms).toISOString()
const row = (over: Partial<ReferralRow>): ReferralRow => ({
  id: crypto.randomUUID(),
  status: "open",
  business: "Hikari Coffee",
  handle: "hikari",
  received: "0",
  lockedAt: null,
  qualifiedAt: null,
  payoutAfter: null,
  paidAt: null,
  voidReason: null,
  createdAt: at(-86_400_000),
  payout: null,
  ...over,
})

const RULES = {
  threshold: "5000000",
  reward: "1000000",
  windowDays: 30,
  holdMinutes: 10,
  yearlyCap: 10,
}

const MIX: ReferralsView = {
  handle: "studio-kaze",
  network: "testnet",
  rules: RULES,
  invited: [
    row({ business: "Northwind Ltd", received: "3200000", lockedAt: at(-3_600_000) }),
    row({
      business: "Kofi Mensah Studio",
      received: "5000000",
      status: "qualified",
      qualifiedAt: at(-120_000),
      payoutAfter: at(480_000),
    }),
    row({
      business: "Hikari Coffee",
      received: "6500000",
      status: "paid",
      paidAt: at(-86_400_000),
      payout: {
        id: "00000000-0000-4000-8000-000000000001",
        status: "sent",
        txHash: "4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX",
        error: null,
      },
    }),
    row({
      business: "Mei Design",
      status: "void",
      voidReason: "30 days passed before it qualified",
    }),
  ],
  referredBy: row({ business: "Abu Studio", received: "1200000" }),
}

export default function ReferFlow() {
  const [state, setState] = useState<State>("mix")
  return (
    <div className="flex flex-col gap-12 pt-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">Refer</span>
          <Segmented
            label="State"
            value={state}
            onValueChange={(v) => setState(v as State)}
            options={[
              { value: "mix", label: "With invites" },
              { value: "empty", label: "None yet" },
              { value: "loading", label: "Loading" },
              { value: "error", label: "Error" },
            ]}
          />
        </div>
        <ReferView
          data={
            state === "mix"
              ? MIX
              : state === "empty"
                ? { ...MIX, invited: [], referredBy: null }
                : undefined
          }
          error={state === "error"}
          onRetry={() => setState("mix")}
          url="https://tegata.xyz/join/studio-kaze"
          businessName={SAMPLE_BUSINESS}
          saving={false}
          problem={null}
          onSetReferrer={() => undefined}
          onRemoveReferrer={() => undefined}
        />
      </section>
      <section className="flex flex-col gap-4">
        <span className="display text-[30px]">The join link a friend opens</span>
        <div className="overflow-hidden rounded-[24px] ring-1 ring-secondary">
          <JoinView
            handle="studio-kaze"
            business={SAMPLE_BUSINESS}
            threshold="5000000"
            reward="1000000"
            windowDays={30}
            sandbox
          />
        </div>
      </section>
    </div>
  )
}
