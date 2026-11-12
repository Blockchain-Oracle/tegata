"use client"

// Home and Send in every state (plan 6.9), on sample data that lives only under /dev.
import { useState } from "react"

import { HomeView } from "@/components/home/home-view"
import { Segmented } from "@/components/kit/segmented"
import { type SendStep, SendView } from "@/components/send/send-view"
import type { ActivityItem } from "@/lib/client/types"

const ACTIVITY: ActivityItem[] = [
  {
    id: "0",
    kind: "received",
    network: "testnet",
    counterparty: "northwind.tegata.testnet",
    title: "Logo design",
    amount: "1250000000",
    status: "succeeded",
    receiptToken: null,
    explorerUrl: null,
    at: new Date(Date.now() - 90_000).toISOString(),
  },
  {
    id: "1",
    kind: "send",
    title: null,
    receiptToken: null,
    network: "testnet",
    counterparty: "kofi.tegata.testnet",
    amount: "2400000000",
    status: "success",
    explorerUrl: null,
    at: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    id: "2",
    kind: "send",
    title: null,
    receiptToken: null,
    network: "testnet",
    counterparty: "mei.tegata.testnet",
    amount: "480000000",
    status: "sent",
    explorerUrl: null,
    at: new Date(Date.now() - 50_000).toISOString(),
  },
  {
    id: "3",
    kind: "send",
    title: null,
    receiptToken: null,
    network: "testnet",
    counterparty: "sara.tegata.testnet",
    amount: "125000000",
    status: "failed",
    explorerUrl: null,
    at: new Date(Date.now() - 26 * 3_600_000).toISOString(),
  },
]

type HomeState = "fresh" | "busy" | "loading" | "error"

export default function HomeFlow() {
  const [home, setHome] = useState<HomeState>("busy")
  const [send, setSend] = useState<SendStep>("form")
  const [to, setTo] = useState("kofi.tegata.testnet")
  const [amount, setAmount] = useState("240")
  const [progress, setProgress] = useState(1)

  return (
    <div className="flex flex-col gap-10 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="display text-[30px]">Home</span>
        <Segmented
          label="Home state"
          value={home}
          onValueChange={(v) => setHome(v as HomeState)}
          options={[
            { value: "fresh", label: "New account" },
            { value: "busy", label: "With activity" },
            { value: "loading", label: "Loading" },
            { value: "error", label: "Activity error" },
          ]}
        />
      </div>
      <HomeView
        businessName="Studio Kaze"
        accountId="studio-kaze.tegata.testnet"
        balance={home === "fresh" ? 0n : 12_480_000_000n}
        explorerUrl="https://testnet.nearblocks.io"
        activity={
          home === "fresh" ? [] : home === "loading" || home === "error" ? undefined : ACTIVITY
        }
        activityError={home === "error"}
        onReceive={() => undefined}
        onRetryActivity={() => setHome("busy")}
      />

      <div className="flex flex-wrap items-center gap-3 pt-8">
        <span className="display text-[30px]">Send</span>
        <Segmented
          label="Send state"
          value={send}
          onValueChange={(v) => {
            setSend(v as SendStep)
            if (v === "sending") {
              setProgress(1)
              setTimeout(() => setProgress(2), 1200)
              setTimeout(() => setProgress(3), 2600)
            }
          }}
          options={[
            { value: "form", label: "Form" },
            { value: "review", label: "Review" },
            { value: "sending", label: "Sending" },
            { value: "sent", label: "Sent" },
            { value: "failed", label: "Failed" },
          ]}
        />
      </div>
      <SendView
        step={send}
        to={to}
        onTo={setTo}
        amount={amount}
        onAmount={setAmount}
        balance={12480}
        businessName="Studio Kaze"
        suffix=".tegata.testnet"
        busy={false}
        problem={send === "failed" ? "The relay expired before NEAR saw it." : null}
        progress={progress}
        explorerUrl="https://testnet.nearblocks.io"
        relayId={null}
        onReview={() => setSend("review")}
        onApprove={() => {
          setSend("sending")
          setProgress(1)
          setTimeout(() => setProgress(2), 1200)
          setTimeout(() => setProgress(3), 2600)
          setTimeout(() => setSend("sent"), 3000)
        }}
        onEdit={() => setSend("form")}
        onReceive={() => undefined}
        onAgain={() => setSend("form")}
      />
    </div>
  )
}
