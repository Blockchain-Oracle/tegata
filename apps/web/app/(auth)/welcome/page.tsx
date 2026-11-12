"use client"

// Welcome (plan 6.8 B): name the business, pick the pay address, watch the account open on NEAR, see the seal land.
// The steps on the stage follow the real account-setup job: created on NEAR (createdTx), registered for USDC (readyAt).
import { useMutation, useQuery } from "@tanstack/react-query"
import { NETWORKS } from "@tegata/config"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import type { FieldStatus } from "@/components/kit/field"
import type { WelcomeStage } from "@/components/onboarding/bill-stage"
import { setupSteps, toHandle } from "@/components/onboarding/setup"
import { WelcomeView } from "@/components/onboarding/welcome-view"
import { useProfile } from "@/hooks/use-profile"
import { ApiError, api } from "@/lib/client/api"
import { fire } from "@/lib/feedback"

const DEBOUNCE_MS = 350
/** The seal step is ours: it completes a beat after USDC registration so the press reads as its own moment. */
const SEAL_BEAT_MS = 900

interface HandleCheck {
  handle: string
  available: boolean
  problem: string | null
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

export default function WelcomePage() {
  const router = useRouter()
  const { ready, authenticated, profile, refetch } = useProfile()
  const [step, setStep] = useState<"name" | "handle">("name")
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [handleEdited, setHandleEdited] = useState(false)
  const [openedHere, setOpenedHere] = useState(false)
  const [sealCut, setSealCut] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())

  const network = profile?.networks.includes("mainnet") ? "mainnet" : "testnet"
  const suffix = `.${NETWORKS[network].operator}`
  const wanted = handleEdited ? handle : toHandle(name)
  const debounced = useDebounced(wanted, DEBOUNCE_MS)
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  const check = useQuery({
    queryKey: ["handle", debounced],
    queryFn: () => api<HandleCheck>(`/api/handle?name=${encodeURIComponent(debounced)}`),
    enabled: step === "handle" && debounced.length > 1 && Boolean(profile),
  })

  const open = useMutation({
    mutationFn: () =>
      api("/api/onboard", { body: { handle: wanted, businessName: name.trim(), timezone } }),
    onSuccess: () => {
      setOpenedHere(true)
      setStartedAt(Date.now())
      void refetch()
    },
    onError: () => fire("fail", { cue: "error" }),
  })

  useEffect(() => {
    if (ready && !authenticated) router.replace("/signin")
  }, [ready, authenticated, router])

  const account = profile?.accounts[0]
  const settingUp = Boolean(profile?.user.handle)
  const allReady =
    settingUp && (profile?.accounts.length ?? 0) > 0 && profile!.accounts.every((a) => a.readyAt)

  // A returning visit with everything done goes straight in; a fresh opening stays for the seal.
  useEffect(() => {
    if (allReady && !openedHere) router.replace("/app")
  }, [allReady, openedHere, router])

  useEffect(() => {
    if (!allReady || !openedHere) return
    const t = setTimeout(() => setSealCut(true), SEAL_BEAT_MS)
    return () => clearTimeout(t)
  }, [allReady, openedHere])

  // Picking up an account that was already being set up (a reload mid-way).
  useEffect(() => {
    if (settingUp && !allReady && !openedHere) {
      setOpenedHere(true)
      if (profile?.workspace?.name) setName(profile.workspace.name)
    }
  }, [settingUp, allReady, openedHere, profile?.workspace?.name])

  const stage: WelcomeStage = !settingUp ? step : sealCut ? "open" : "opening"
  const current = !account ? 0 : account.readyAt ? (sealCut ? 3 : 2) : account.createdTx ? 1 : 0
  const shownHandle = settingUp && profile?.user.handle ? profile.user.handle : wanted

  const status = check.data && check.data.handle === wanted ? check.data : undefined
  const handleStatus: FieldStatus =
    wanted.length < 2
      ? { kind: "none" }
      : check.isFetching || debounced !== wanted
        ? { kind: "checking" }
        : status?.available
          ? { kind: "ok", text: "Available" }
          : status
            ? { kind: "bad", text: status.problem ?? "Taken. Try another." }
            : check.isError
              ? { kind: "bad", text: "Couldn't check right now. Try again." }
              : { kind: "none" }

  return (
    <WelcomeView
      stage={stage}
      name={settingUp && profile?.workspace?.name ? profile.workspace.name : name}
      onName={setName}
      handle={shownHandle}
      onHandle={(v) => {
        setHandleEdited(true)
        setHandle(toHandle(v))
      }}
      suffix={suffix}
      handleStatus={handleStatus}
      timezone={timezone}
      canContinue={name.trim().length >= 2}
      canOpen={status?.available === true && !open.isPending}
      opening={open.isPending}
      openError={
        open.error
          ? open.error instanceof ApiError
            ? open.error.message
            : "We couldn't open the account. Try again."
          : null
      }
      setupStartedAt={startedAt}
      steps={setupSteps(`${shownHandle}${suffix}`)}
      current={current}
      failed={false}
      onNext={() => setStep("handle")}
      onBack={() => setStep("name")}
      onOpen={() => open.mutate()}
      onRetry={() => {
        setStartedAt(Date.now())
        void refetch()
      }}
      onDone={() => router.replace("/app")}
    />
  )
}
