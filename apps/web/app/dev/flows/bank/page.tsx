"use client"

// Bank in every state (plan 6.8 AC′): withdraw (converter, recipients, the bank naming the holder, review, on its way,
// paid, failed), Live locked, and Receive (the euro account card, a test transfer, deposits), on sample data only.
// "New recipient" opens the real sheet: Nigeria asks the bank for the name, Ghana and South Africa ask for it.
import { useCallback, useState } from "react"

import {
  type BankQuoteView,
  type BankStep,
  type BankTab,
  BankView,
  type FormSchema,
  type NewRecipient,
} from "@/components/bank/bank-view"
import { Segmented } from "@/components/kit/segmented"
import { SAMPLE_BANK } from "@/lib/dev/sample"

type State =
  | "withdraw"
  | "confirm"
  | "review"
  | "sending"
  | "paid"
  | "failed"
  | "receive"
  | "fresh"
  | "live"

const STEP: Record<State, BankStep> = {
  withdraw: "form",
  confirm: "form",
  review: "review",
  sending: "sending",
  paid: "paid",
  failed: "failed",
  receive: "form",
  fresh: "form",
  live: "form",
}

export default function BankFlow() {
  const [state, setState] = useState<State>("withdraw")
  const [tab, setTab] = useState<BankTab>("withdraw")
  const [amount, setAmount] = useState("20")
  const [country, setCountry] = useState("NG")
  const [accountId, setAccountId] = useState<string | null>("dev-acct")
  const [fresh, setFresh] = useState<NewRecipient | null>(null)
  const [progress, setProgress] = useState(2)
  // The sample bank answers like Noah's sandbox: Access Bank 0690000031 is Forrest Green.
  const checkHolder = useCallback(
    (form: Record<string, unknown>) =>
      new Promise<string | null>((resolve, reject) =>
        setTimeout(() => {
          const number = (form.BankDetails as { AccountNumber?: string })?.AccountNumber
          if (number === "0690000031") resolve("Forrest Green")
          else if (number?.startsWith("0")) resolve("Chiamaka Eze")
          else reject(new Error("The bank didn't find this account. Check the number."))
        }, 900),
      ),
    [],
  )
  const schema = (
    country === "GH"
      ? SAMPLE_BANK.schemaGH
      : country === "ZA"
        ? SAMPLE_BANK.schemaZA
        : SAMPLE_BANK.schema
  ) as FormSchema
  const quote = (
    country === "NG" ? SAMPLE_BANK.quote : SAMPLE_BANK.quotes[country as "GH" | "ZA"]
  ) as BankQuoteView
  return (
    <div className="flex flex-col gap-8 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="display text-[30px]">Bank</span>
        <Segmented
          label="Bank state"
          value={state}
          onValueChange={(v) => {
            setState(v as State)
            setTab(v === "receive" || v === "fresh" ? "receive" : "withdraw")
            if (v === "sending") {
              setProgress(1)
              setTimeout(() => setProgress(2), 1200)
              setTimeout(() => setProgress(3), 2600)
            }
          }}
          options={[
            { value: "withdraw", label: "Withdraw" },
            { value: "confirm", label: "Bank names" },
            { value: "review", label: "Review" },
            { value: "sending", label: "On its way" },
            { value: "paid", label: "Paid" },
            { value: "failed", label: "Failed" },
            { value: "receive", label: "Receive" },
            { value: "fresh", label: "No details" },
            { value: "live", label: "Live locked" },
          ]}
        />
      </div>
      <BankView
        available={state !== "live"}
        businessName="Studio Kaze"
        balance={482.5}
        tab={tab}
        onTab={setTab}
        countries={SAMPLE_BANK.countries}
        country={country}
        onCountry={(c) => {
          setCountry(c)
          setFresh(null)
          setAccountId(c === "NG" ? "dev-acct" : null)
        }}
        amount={amount}
        onAmount={setAmount}
        saved={SAMPLE_BANK.saved}
        fresh={fresh}
        onFresh={(r) => {
          setFresh(r)
          setAccountId(null)
        }}
        accountId={accountId}
        onAccount={setAccountId}
        schema={schema}
        checkHolder={checkHolder}
        quote={{ data: quote, loading: false }}
        step={STEP[state]}
        payout={STEP[state] === "form" ? null : SAMPLE_BANK.payout(state)}
        progress={progress}
        busy={false}
        problem={state === "failed" ? "Noah couldn't pay the bank account." : null}
        holder={state === "confirm" ? "Forrest Green" : null}
        onConfirmHolder={() => setState("review")}
        onRejectHolder={() => setState("withdraw")}
        onReview={() => setState("review")}
        onApprove={() => setState("sending")}
        onEdit={() => setState("withdraw")}
        onAgain={() => setState("withdraw")}
        details={state === "fresh" ? null : SAMPLE_BANK.details}
        deposits={state === "fresh" ? [] : SAMPLE_BANK.deposits}
        onGetDetails={() => setState("receive")}
        gettingDetails={false}
        onSimulate={() => undefined}
        simulating={false}
        simulated={false}
        recent={SAMPLE_BANK.recent}
      />
    </div>
  )
}
