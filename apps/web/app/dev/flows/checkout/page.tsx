"use client"

// /dev: the Checkout page with sample pay links: a button chosen, nothing yet, loading, and an error. The preview
// button opens the real checkout only for real links, so here it shows the look and the code.
import { useState } from "react"

import { CheckoutView } from "@/components/checkout/checkout-view"
import { Segmented } from "@/components/kit/segmented"
import { SAMPLE_LINKS } from "@/lib/dev/sample"

type State = "links" | "empty" | "loading" | "error"

export default function CheckoutFlow() {
  const [state, setState] = useState<State>("links")
  return (
    <div className="flex flex-col gap-6 pt-6">
      <Segmented
        label="Checkout state"
        value={state}
        onValueChange={(v) => setState(v as State)}
        options={[
          { value: "links", label: "With links" },
          { value: "empty", label: "No links" },
          { value: "loading", label: "Loading" },
          { value: "error", label: "Error" },
        ]}
        className="max-w-[520px]"
      />
      <CheckoutView
        key={state}
        links={state === "links" ? SAMPLE_LINKS : state === "empty" ? [] : undefined}
        error={state === "error"}
        onRetry={() => setState("links")}
        origin="https://tegata.xyz"
        sandbox
        canPreview={false}
      />
    </div>
  )
}
