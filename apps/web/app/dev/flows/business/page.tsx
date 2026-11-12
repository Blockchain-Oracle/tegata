"use client"

// The business profile in every state (plan 6.9), on sample data that lives only under /dev.
import { useState } from "react"

import { Segmented } from "@/components/kit/segmented"
import { BusinessView } from "@/components/settings/business-view"
import { SAMPLE_ACCOUNT, SAMPLE_BUSINESS } from "@/lib/dev/sample"

type State = "filled" | "new" | "saving" | "error"

export default function BusinessFlow() {
  const [state, setState] = useState<State>("filled")
  return (
    <div className="flex flex-col gap-8 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="display text-[30px]">Business profile</span>
        <Segmented
          label="State"
          value={state}
          onValueChange={(v) => setState(v as State)}
          options={[
            { value: "filled", label: "Filled in" },
            { value: "new", label: "Just opened" },
            { value: "saving", label: "Saving" },
            { value: "error", label: "Field error" },
          ]}
        />
      </div>
      <BusinessView
        key={state}
        initial={
          state === "new"
            ? {
                name: SAMPLE_BUSINESS,
                address: "",
                taxId: "",
                email: "",
                timezone: "Africa/Lagos",
                logo: null,
              }
            : {
                name: SAMPLE_BUSINESS,
                address: "12 Market Street\nLagos 100001\nNigeria",
                taxId: "NG-TIN 20381144-0001",
                email: "accounts@studiokaze.com",
                timezone: "Africa/Lagos",
                logo: null,
              }
        }
        accountId={SAMPLE_ACCOUNT}
        signInEmail="owner@studiokaze.com"
        saving={state === "saving"}
        problem={
          state === "error"
            ? { field: "email", message: "Enter an email like accounts@studio.com" }
            : null
        }
        onSave={() => undefined}
      />
    </div>
  )
}
