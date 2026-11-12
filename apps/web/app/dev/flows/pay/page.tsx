"use client"

// The pay page and the receipt in every state (plan 6.9), on sample data that lives only under /dev. The quote in
// "Another chain" is a fixed sample here; the real page asks NEAR Intents live.
import { useEffect, useState } from "react"

import { Segmented } from "@/components/kit/segmented"
import { type PayStep, PayView, type TegataState } from "@/components/pay/pay-view"
import { ReceiptView } from "@/components/receipt/receipt-view"
import type { PaymentRail } from "@/lib/client/types"
import {
  SAMPLE_RECEIPT,
  SAMPLE_REQUEST,
  SAMPLE_REWARD_RECEIPT,
  SAMPLE_ROUTES,
  SAMPLE_SEND_RECEIPT,
} from "@/lib/dev/sample"

type Payer = "signed_out" | "ready" | "short" | "own" | "wallet" | "chain" | "any"
type Step = PayStep | "closed"

const TEGATA: Record<Payer, TegataState> = {
  signed_out: { kind: "signed_out" },
  ready: { kind: "ready", accountId: "northwind.tegata.testnet", balance: 4210 },
  short: { kind: "ready", accountId: "northwind.tegata.testnet", balance: 312.4 },
  own: { kind: "own_link", accountId: "studio-kaze.tegata.testnet" },
  wallet: { kind: "signed_out" },
  chain: { kind: "signed_out" },
  any: { kind: "ready", accountId: "northwind.tegata.testnet", balance: 4210 },
}

export default function PayFlow() {
  const [payer, setPayer] = useState<Payer>("ready")
  const [step, setStep] = useState<Step>("choose")
  const [rail, setRail] = useState<PaymentRail | null>("tegata")
  const [amount, setAmount] = useState("")
  const [routeId, setRouteId] = useState<string>(SAMPLE_ROUTES[0].id)
  const [progress, setProgress] = useState(1)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [replay, setReplay] = useState(0)
  const usedRail: PaymentRail = payer === "wallet" ? "near_wallet" : "tegata"

  useEffect(() => {
    setRail(payer === "wallet" ? "near_wallet" : payer === "chain" ? "oneclick" : "tegata")
  }, [payer])

  const play = () => {
    setStep("paying")
    setStartedAt(Date.now())
    setProgress(1)
    setTimeout(() => setProgress(2), 1400)
    setTimeout(() => setProgress(3), 2800)
    setTimeout(() => setStep("paid"), 3200)
  }

  return (
    <div className="flex flex-col gap-8 pt-6">
      <div className="flex flex-col gap-3">
        <span className="display text-[30px]">Pay page</span>
        <Segmented
          label="Payer"
          value={payer}
          onValueChange={(v) => {
            setPayer(v as Payer)
            setStep("choose")
          }}
          options={[
            { value: "signed_out", label: "Signed out" },
            { value: "ready", label: "Tegata" },
            { value: "short", label: "Low balance" },
            { value: "own", label: "Own link" },
            { value: "wallet", label: "Wallet" },
            { value: "chain", label: "Other chain" },
            { value: "any", label: "Any amount" },
          ]}
        />
        <Segmented
          label="Step"
          value={step}
          onValueChange={(v) => {
            if (v === "paying") play()
            else setStep(v as Step)
            if (v === "paid") setReplay((n) => n + 1)
          }}
          options={[
            { value: "choose", label: "Choose" },
            { value: "paying", label: "Paying" },
            { value: "paid", label: "Paid" },
            { value: "failed", label: "Failed" },
            { value: "closed", label: "Closed link" },
          ]}
        />
      </div>
      <div className="overflow-hidden rounded-[24px] ring-1 ring-secondary">
        <PayView
          key={replay}
          request={{
            ...SAMPLE_REQUEST,
            amount: payer === "any" ? null : SAMPLE_REQUEST.amount,
            title: payer === "any" ? "Tip jar" : SAMPLE_REQUEST.title,
            note: payer === "any" ? null : SAMPLE_REQUEST.note,
            status: step === "closed" ? "closed" : "open",
          }}
          amount={amount}
          onAmount={setAmount}
          rail={rail}
          onRail={setRail}
          step={step === "closed" ? "choose" : step}
          tegata={TEGATA[payer]}
          onSignIn={() => setPayer("ready")}
          onFinishAccount={() => setPayer("ready")}
          walletAccount={payer === "wallet" ? "mei.testnet" : null}
          connecting={false}
          onConnect={() => setPayer("wallet")}
          onDisconnect={() => setPayer("signed_out")}
          routes={SAMPLE_ROUTES}
          routeId={routeId}
          onRoute={setRouteId}
          quote={{ data: { amountInFormatted: "1264.23", timeEstimate: 80 }, loading: false }}
          busy={false}
          problem={
            step === "failed"
              ? usedRail === "near_wallet"
                ? "That transaction didn't pay this link"
                : "The relay expired before NEAR saw it."
              : null
          }
          onPayTegata={play}
          onPayWallet={play}
          usedRail={usedRail}
          progress={progress}
          startedAt={startedAt}
          attempt={{
            id: `sample-${replay}`,
            status: step === "paid" ? "succeeded" : "detected",
            rail: usedRail,
            relayStatus: "success",
            amount: SAMPLE_REQUEST.amount!,
            error: null,
            receiptToken: "sampleReceipt01",
            explorerUrl: SAMPLE_RECEIPT.explorerUrl,
          }}
          onTryAgain={() => setStep("choose")}
        />
      </div>

      <span className="display pt-8 text-[30px]">Receipts</span>
      <div className="grid gap-4 xl:grid-cols-3">
        {[
          {
            label: "A customer payment (numbered)",
            receipt: SAMPLE_RECEIPT,
            token: "sampleReceipt01",
          },
          { label: "A send", receipt: SAMPLE_SEND_RECEIPT, token: "send:sample" },
          { label: "A referral reward", receipt: SAMPLE_REWARD_RECEIPT, token: "reward:sample" },
        ].map((r) => (
          <div key={r.token} className="flex flex-col gap-2">
            <span className="text-detail font-semibold text-muted-foreground">{r.label}</span>
            <div className="overflow-hidden rounded-[24px]">
              <ReceiptView receipt={r.receipt} token={r.token} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
