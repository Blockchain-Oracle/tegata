"use client"

// Home and Send in every state, on sample data that lives only under /dev.
import { useState } from "react"

import { HomeView } from "@/components/home/home-view"
import { Segmented } from "@/components/kit/segmented"
import { type ChainSendStep, ChainSendView } from "@/components/send/chain-send-view"
import { SendToSwitch } from "@/components/send/send-to-switch"
import { type SendStep, SendView } from "@/components/send/send-view"
import type { ActivityItem, PayoutView } from "@/lib/client/types"
import { PAYER_ROUTES } from "@/lib/routes"

const PAYOUT: PayoutView = {
  id: "dev-payout",
  status: "delivered",
  swapStatus: "SUCCESS",
  amount: "240000000",
  symbol: "USDT",
  chain: "Tron",
  recipient: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
  amountOutFormatted: "239.71",
  txHash: "4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX",
  destinationTx: "a3f1c2d4e5b6a7980b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a",
  error: null,
  deliveredAt: "2026-11-13T12:04:00.000Z",
  timeEstimate: 150,
  createdAt: "2026-11-13T12:01:00.000Z",
}

type ChainState = ChainSendStep | "quoting" | "no-route" | "sandbox"

const ACTIVITY: ActivityItem[] = [
  {
    id: "0",
    kind: "received",
    network: "testnet",
    counterparty: "northwind.tegata.testnet",
    title: "Logo design",
    amount: "1250000000",
    status: "succeeded",
    receiptUrl: null,
    at: new Date(Date.now() - 90_000).toISOString(),
  },
  {
    id: "1",
    kind: "send",
    title: null,
    receiptUrl: null,
    network: "testnet",
    counterparty: "kofi.tegata.testnet",
    amount: "2400000000",
    status: "success",
    at: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    id: "2",
    kind: "send",
    title: null,
    receiptUrl: null,
    network: "testnet",
    counterparty: "mei.tegata.testnet",
    amount: "480000000",
    status: "sent",
    at: new Date(Date.now() - 50_000).toISOString(),
  },
  {
    id: "3",
    kind: "send",
    title: null,
    receiptUrl: null,
    network: "testnet",
    counterparty: "sara.tegata.testnet",
    amount: "125000000",
    status: "failed",
    at: new Date(Date.now() - 26 * 3_600_000).toISOString(),
  },
  {
    id: "4",
    kind: "received",
    network: "mainnet",
    counterparty: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
    title: "Brand workshop",
    amount: "3400000000",
    status: "succeeded",
    receiptUrl: null,
    at: new Date(Date.now() - 30 * 3_600_000).toISOString(),
  },
  {
    id: "5",
    kind: "payroll",
    network: "testnet",
    counterparty: "studio-kaze.tegata.testnet",
    title: "1–15 Nov",
    amount: "6200000000",
    status: "succeeded",
    receiptUrl: null,
    at: new Date(Date.now() - 50 * 3_600_000).toISOString(),
  },
  {
    id: "6",
    kind: "reward",
    network: "testnet",
    counterparty: "Tegata",
    title: "Referral reward: you invited a business",
    amount: "1000000",
    status: "succeeded",
    receiptUrl: null,
    at: new Date(Date.now() - 70 * 3_600_000).toISOString(),
  },
  {
    id: "7",
    kind: "paid",
    network: "testnet",
    counterparty: "Hikari Coffee",
    title: "Beans, November",
    amount: "86500000",
    status: "succeeded",
    receiptUrl: null,
    at: new Date(Date.now() - 90 * 3_600_000).toISOString(),
  },
]

type HomeState = "fresh" | "busy" | "loading" | "error"

export default function HomeFlow() {
  const [home, setHome] = useState<HomeState>("busy")
  const [send, setSend] = useState<SendStep>("form")
  const [to, setTo] = useState("kofi.tegata.testnet")
  const [amount, setAmount] = useState("240")
  const [progress, setProgress] = useState(1)
  const [chain, setChain] = useState<ChainState>("form")
  const [chainProgress, setChainProgress] = useState(1)
  const [chainRoute, setChainRoute] = useState("usdt-tron")
  const [chainTo, setChainTo] = useState("TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE")
  const [chainAmount, setChainAmount] = useState("240")
  const playChain = () => {
    setChain("sending")
    setChainProgress(1)
    setTimeout(() => setChainProgress(2), 1200)
    setTimeout(() => setChainProgress(3), 2600)
    setTimeout(() => setChain("delivered"), 4200)
  }

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
        activity={
          home === "fresh" ? [] : home === "loading" || home === "error" ? undefined : ACTIVITY
        }
        activityError={home === "error"}
        onReceive={() => undefined}
        onRetryActivity={() => setHome("busy")}
        pots={
          home === "busy"
            ? { spendable: 8_736_000_000n, tax: 2_496_000_000n, savings: 1_248_000_000n }
            : null
        }
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
        switcher={<SendToSwitch value="near" onChange={() => undefined} />}
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

      <div className="flex flex-wrap items-center gap-3 pt-8">
        <span className="display text-[30px]">Send to another chain</span>
        <Segmented
          label="Send to another chain state"
          value={chain}
          onValueChange={(v) => (v === "sending" ? playChain() : setChain(v as ChainState))}
          options={[
            { value: "form", label: "Form" },
            { value: "sandbox", label: "Sandbox" },
            { value: "quoting", label: "Quoting" },
            { value: "no-route", label: "No route" },
            { value: "review", label: "Review" },
            { value: "sending", label: "Sending" },
            { value: "delivered", label: "Delivered" },
            { value: "refunded", label: "Refunded" },
            { value: "failed", label: "Failed" },
          ]}
        />
      </div>
      <ChainSendView
        step={chain === "quoting" || chain === "no-route" || chain === "sandbox" ? "form" : chain}
        sandbox={chain === "sandbox"}
        switcher={<SendToSwitch value="chain" onChange={() => undefined} />}
        routes={PAYER_ROUTES}
        routeId={chainRoute}
        onRoute={setChainRoute}
        to={chainTo}
        onTo={setChainTo}
        amount={chainAmount}
        onAmount={setChainAmount}
        balance={12480}
        businessName="Studio Kaze"
        preview={
          chain === "quoting"
            ? { loading: true }
            : chain === "no-route"
              ? {
                  loading: false,
                  error: "That amount is below this route's minimum. Send a little more.",
                }
              : {
                  loading: false,
                  data: {
                    amountOutFormatted: "239.71",
                    minAmountOut: "239470000",
                    amountOutUsd: "239.69",
                    timeEstimate: 150,
                  },
                }
        }
        payout={{
          ...PAYOUT,
          status: chain === "refunded" ? "refunded" : chain === "failed" ? "failed" : PAYOUT.status,
          txHash: chain === "failed" ? null : PAYOUT.txHash,
        }}
        progress={chainProgress}
        busy={false}
        problem={chain === "failed" ? "NEAR didn't accept the transfer. Nothing moved." : null}
        onReview={() => setChain("review")}
        onApprove={playChain}
        onEdit={() => setChain("form")}
        onAgain={() => setChain("form")}
        onReceive={() => undefined}
      />
    </div>
  )
}
