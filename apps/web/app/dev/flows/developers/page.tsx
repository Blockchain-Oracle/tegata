"use client"

// Developers and the counter in every state, on sample data only.
import { useState } from "react"

import { CounterView } from "@/components/counter/counter-view"
import { DevelopersView } from "@/components/developers/developers-view"
import { Segmented } from "@/components/kit/segmented"
import { SAMPLE_BUSINESS, SAMPLE_COUNTER_SALES, SAMPLE_DEVELOPERS } from "@/lib/dev/sample"

type DevState = "set-up" | "new" | "loading"
type CounterState = "keypad" | "waiting" | "paid"

export default function DevelopersFlow() {
  const [dev, setDev] = useState<DevState>("set-up")
  const [counter, setCounter] = useState<CounterState>("keypad")
  const [amount, setAmount] = useState("4.50")
  const [newKey, setNewKey] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-12 pt-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">Developers</span>
          <Segmented
            label="State"
            value={dev}
            onValueChange={(v) => setDev(v as DevState)}
            options={[
              { value: "set-up", label: "Keys and webhooks" },
              { value: "new", label: "Nothing yet" },
              { value: "loading", label: "Loading" },
            ]}
          />
        </div>
        <DevelopersView
          data={
            dev === "loading"
              ? undefined
              : dev === "new"
                ? { ...SAMPLE_DEVELOPERS, keys: [], endpoints: [], deliveries: [], inbox: [] }
                : SAMPLE_DEVELOPERS
          }
          error={false}
          onRetry={() => undefined}
          busy={false}
          problem={null}
          newKey={newKey}
          onCreateKey={() => setNewKey("tk_test_mNC-sample-key-shown-once-only")}
          onCloseKey={() => setNewKey(null)}
          onRevokeKey={() => undefined}
          onAddEndpoint={() => undefined}
          onAddInbox={() => undefined}
          onToggle={() => undefined}
          onDelete={() => undefined}
          onTest={() => undefined}
          onReveal={() => undefined}
          revealed={{}}
          newSecret={null}
          onCloseSecret={() => undefined}
          onResend={() => undefined}
        />
      </section>
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">Counter</span>
          <Segmented
            label="Counter state"
            value={counter}
            onValueChange={(v) => setCounter(v as CounterState)}
            options={[
              { value: "keypad", label: "Keypad" },
              { value: "waiting", label: "Waiting" },
              { value: "paid", label: "Paid" },
            ]}
          />
        </div>
        <CounterView
          business={SAMPLE_BUSINESS}
          amount={amount}
          onAmount={setAmount}
          note=""
          onNote={() => undefined}
          sale={
            counter === "keypad"
              ? null
              : {
                  url: "https://tegata.xyz/pay/E32DvMBiifrjmx",
                  amount: "4500000",
                }
          }
          paid={counter === "paid"}
          startedAt={0}
          busy={false}
          problem={null}
          onCharge={() => setCounter("waiting")}
          onNew={() => setCounter("keypad")}
          sales={SAMPLE_COUNTER_SALES}
        />
      </section>
    </div>
  )
}
