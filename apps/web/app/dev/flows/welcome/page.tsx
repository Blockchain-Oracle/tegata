"use client"

// Welcome in every state, without opening a real account (plan 6.9). "Open my account" plays the real step timings:
// created on NEAR after ~2.5 s, registered for USDC after ~4.5 s, then the seal. "taken" is an unavailable name.
import { useEffect, useState } from "react"

import type { FieldStatus } from "@/components/kit/field"
import type { WelcomeStage } from "@/components/onboarding/bill-stage"
import { setupSteps, toHandle } from "@/components/onboarding/setup"
import { WelcomeView } from "@/components/onboarding/welcome-view"

/** `?wallet=1`: the person signed in with a NEAR wallet, so step 2 shows their own account (plan 6.8 AA). */
const SAMPLE_WALLET = "studio-kaze.testnet"

export default function WelcomeFlow() {
  const [wallet, setWallet] = useState<string | null>(null)
  useEffect(() => {
    setWallet(new URLSearchParams(window.location.search).get("wallet") ? SAMPLE_WALLET : null)
  }, [])
  const [stage, setStage] = useState<WelcomeStage>("name")
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [edited, setEdited] = useState(false)
  const [current, setCurrent] = useState(0)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [checking, setChecking] = useState(false)
  const wanted = edited ? handle : toHandle(name)

  useEffect(() => {
    if (stage !== "handle" || wanted.length < 2) return
    setChecking(true)
    const t = setTimeout(() => setChecking(false), 500)
    return () => clearTimeout(t)
  }, [wanted, stage])

  useEffect(() => {
    if (stage !== "opening") return
    const timers = [
      setTimeout(() => setCurrent(1), wallet ? 300 : 2500),
      setTimeout(() => setCurrent(2), 4500),
      setTimeout(() => setCurrent(3), 5400),
      setTimeout(() => setStage("open"), 5600),
    ]
    return () => timers.forEach(clearTimeout)
  }, [stage, wallet])

  const taken = wanted === "taken" || wanted === "abu"
  const status: FieldStatus =
    wanted.length < 2
      ? { kind: "none" }
      : checking
        ? { kind: "checking" }
        : taken
          ? { kind: "bad", text: `Taken. Try ${wanted}-studio` }
          : { kind: "ok", text: "Available" }

  return (
    <WelcomeView
      stage={stage}
      name={name}
      onName={setName}
      handle={wanted}
      onHandle={(v) => {
        setEdited(true)
        setHandle(toHandle(v))
      }}
      suffix=".tegata.testnet"
      handleStatus={status}
      timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
      canContinue={name.trim().length >= 2}
      canOpen={wallet ? true : !checking && !taken && wanted.length >= 2}
      opening={false}
      openError={null}
      setupStartedAt={startedAt}
      steps={setupSteps(wallet ?? `${wanted}.tegata.testnet`, Boolean(wallet))}
      walletAccount={wallet}
      current={current}
      failed={false}
      onNext={() => setStage("handle")}
      onBack={() => setStage("name")}
      onOpen={() => {
        setCurrent(0)
        setStartedAt(Date.now())
        setStage("opening")
      }}
      onRetry={() => setStartedAt(Date.now())}
      onDone={() => {
        setStage("name")
        setCurrent(0)
      }}
    />
  )
}
