"use client"

// Sign-in: email, then a six-cell code, inside our own page (Privy runs headless). The stage beside the
// form tells the story; when the code is accepted the cells turn vermilion and the Tegata seal presses on the stage.
import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { type SignInStep, SignInView } from "@/components/auth/sign-in-view"
import type { CodeState } from "@/components/kit/code-field"
import {
  hasWalletSession,
  signInWithNearWallet,
  WalletSignInError,
} from "@/lib/client/near-account"
import { rememberNext, takeNext } from "@/lib/client/next-path"
import { fire } from "@/lib/feedback"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_S = 30
/** Let the seal land before leaving the page. */
const AFTER_SEAL_MS = 1100

type Step = SignInStep

export default function SignInPage() {
  const router = useRouter()
  const { ready, authenticated } = usePrivy()
  const { sendCode, loginWithCode } = useLoginWithEmail()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [codeState, setCodeState] = useState<CodeState>("idle")
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const [sealed, setSealed] = useState(false)
  const [walletState, setWalletState] = useState<"idle" | "waiting" | "done">("idle")
  const [walletProblem, setWalletProblem] = useState<string | null>(null)

  // Sent here with ?next= (a checkout's pay window): come back to that path after signing in. Only ever a path on
  // this site (rememberNext refuses anything else). Declared first, so the redirect below already sees it.
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next")
    if (next) rememberNext(next)
  }, [])

  // Already signed in (a returning visit, by email or with a wallet): go straight in.
  useEffect(() => {
    if (sealed) return
    if ((ready && authenticated) || hasWalletSession()) router.replace(takeNext())
  }, [ready, authenticated, sealed, router])

  async function signInWithWallet() {
    setWalletState("waiting")
    setWalletProblem(null)
    setProblem(null)
    try {
      await signInWithNearWallet("testnet")
      setWalletState("done")
      fire("filled", { cue: "confirmed" })
      setSealed(true)
      setTimeout(() => router.replace(takeNext()), AFTER_SEAL_MS)
    } catch (error) {
      setWalletState("idle")
      fire("fail", { cue: "error" })
      const text = error instanceof Error ? error.message : ""
      setWalletProblem(
        /reject|cancel|closed|denied/i.test(text)
          ? "Nothing was signed. Try again when you're ready."
          : error instanceof WalletSignInError
            ? text
            : "Your wallet didn't finish signing in. Try again.",
      )
    }
  }

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const valid = EMAIL.test(email.trim())

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault()
    if (!valid || sending) return
    setSending(true)
    setProblem(null)
    try {
      await sendCode({ email: email.trim() })
      fire("press", { cue: "tap" })
      setStep("code")
      setCode("")
      setCodeState("idle")
      setResendIn(RESEND_S)
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(
        describe(error, "We couldn't send a code to that address. Check it and try again."),
      )
    } finally {
      setSending(false)
    }
  }

  async function submitCode(value: string) {
    setCodeState("checking")
    setProblem(null)
    try {
      await loginWithCode({ code: value })
      setCodeState("accepted")
      fire("filled", { cue: "confirmed" })
      setSealed(true)
      setTimeout(() => router.replace(takeNext()), AFTER_SEAL_MS)
    } catch (error) {
      setCodeState("wrong")
      fire("fail", { cue: "error" })
      setProblem(describe(error, "That code didn't work. Check the latest email and try again."))
      setTimeout(() => {
        setCode("")
        setCodeState("idle")
      }, 700)
    }
  }

  return (
    <SignInView
      step={step}
      email={email}
      onEmail={(value) => {
        setEmail(value)
        setProblem(null)
      }}
      code={code}
      onCode={(value) => {
        setCode(value)
        if (codeState === "wrong") setCodeState("idle")
      }}
      codeState={codeState}
      sending={sending}
      problem={problem}
      resendIn={resendIn}
      sealed={sealed}
      ready={ready}
      valid={valid}
      onRequestCode={requestCode}
      onSubmitCode={submitCode}
      onBack={() => {
        setStep("email")
        setProblem(null)
      }}
      onWallet={signInWithWallet}
      walletState={walletState}
      walletProblem={walletProblem}
    />
  )
}

function describe(error: unknown, fallback: string): string {
  const text = error instanceof Error ? error.message.toLowerCase() : ""
  if (text.includes("too many") || text.includes("rate"))
    return "Too many codes were sent. Wait a minute, then try again."
  if (text.includes("expired")) return "That code has expired. Send a new one."
  if (text.includes("network") || text.includes("fetch"))
    return "No connection. Check your internet and try again."
  return fallback
}
