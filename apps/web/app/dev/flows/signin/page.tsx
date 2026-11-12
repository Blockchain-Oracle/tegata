"use client"

// Sign-in in every state, without signing out (plan 6.9). The code 123456 is accepted here; any other code is wrong.
import { useState } from "react"

import { type SignInStep, SignInView } from "@/components/auth/sign-in-view"
import type { CodeState } from "@/components/kit/code-field"
import { fire } from "@/lib/feedback"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignInFlow() {
  const [step, setStep] = useState<SignInStep>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [codeState, setCodeState] = useState<CodeState>("idle")
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [sealed, setSealed] = useState(false)

  return (
    <div>
      <SignInView
        step={step}
        email={email}
        onEmail={(v) => {
          setEmail(v)
          setProblem(null)
        }}
        code={code}
        onCode={(v) => {
          setCode(v)
          if (codeState === "wrong") setCodeState("idle")
        }}
        codeState={codeState}
        sending={sending}
        problem={problem}
        resendIn={24}
        sealed={sealed}
        ready
        valid={EMAIL.test(email.trim())}
        onRequestCode={(e) => {
          e?.preventDefault()
          setSending(true)
          setTimeout(() => {
            setSending(false)
            fire("press", { cue: "tap" })
            setStep("code")
          }, 700)
        }}
        onSubmitCode={(value) => {
          setCodeState("checking")
          setTimeout(() => {
            if (value === "123456") {
              setCodeState("accepted")
              fire("filled", { cue: "confirmed" })
              setSealed(true)
            } else {
              setCodeState("wrong")
              fire("fail", { cue: "error" })
              setProblem("That code didn't work. Check the latest email and try again.")
              setTimeout(() => {
                setCode("")
                setCodeState("idle")
              }, 700)
            }
          }, 600)
        }}
        onBack={() => {
          setStep("email")
          setSealed(false)
          setProblem(null)
        }}
      />
    </div>
  )
}
