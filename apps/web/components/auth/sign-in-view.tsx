"use client"

// The sign-in screen's look (plan 6.8 A), separate from its logic so /dev/flows can show every state.
import { ArrowLeft, ArrowRight } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { AuthShell } from "@/components/auth/auth-shell"
import { StoryStage } from "@/components/auth/story-stage"
import { Button, Spinner } from "@/components/kit/button"
import { CodeField, type CodeState } from "@/components/kit/code-field"
import { Field } from "@/components/kit/field"

export type SignInStep = "email" | "code"

export interface SignInViewProps {
  step: SignInStep
  email: string
  onEmail: (value: string) => void
  code: string
  onCode: (value: string) => void
  codeState: CodeState
  sending: boolean
  problem: string | null
  resendIn: number
  sealed: boolean
  ready: boolean
  valid: boolean
  onRequestCode: (event?: React.FormEvent) => void
  onSubmitCode: (value: string) => void
  onBack: () => void
}

export function SignInView({
  step,
  email,
  onEmail,
  code,
  onCode,
  codeState,
  sending,
  problem,
  resendIn,
  sealed,
  ready,
  valid,
  onRequestCode,
  onSubmitCode,
  onBack,
}: SignInViewProps) {
  const reduce = useReducedMotion()
  const slide = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, x: -24 },
    transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] as const },
  }

  return (
    <AuthShell
      stage={<StoryStage sealed={sealed} />}
      top={
        step === "code" && !sealed ? (
          <button
            type="button"
            onClick={onBack}
            className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-3.5 text-[14px] font-semibold hover:bg-plate-pressed"
          >
            <ArrowLeft className="size-4" /> Change email
          </button>
        ) : null
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {step === "email" ? (
          <motion.form
            key="email"
            onSubmit={onRequestCode}
            className="flex flex-col gap-7"
            {...slide}
          >
            <div className="flex flex-col gap-3">
              <h1 className="display text-[44px] leading-[0.95] sm:text-[56px]">
                Get paid in exact dollars.
              </h1>
              <p className="text-[17px] text-muted-foreground">
                Sign in or open a business account with your email.
              </p>
            </div>
            <Field
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@business.com"
              aria-label="Email"
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              autoFocus
              big
              status={problem ? { kind: "bad", text: problem } : { kind: "none" }}
              trailing={
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Email me a code"
                  disabled={!valid || !ready}
                  className="size-11 rounded-[12px]"
                >
                  {sending ? <Spinner className="size-5" /> : <ArrowRight />}
                </Button>
              }
            />
            <p className="text-detail text-text-3">
              We'll email you a 6-digit code. No password, no wallet to install.
            </p>
          </motion.form>
        ) : (
          <motion.div key="code" className="flex flex-col gap-7" {...slide}>
            <div className="flex flex-col gap-3">
              <h1 className="display text-[44px] leading-[0.95] sm:text-[56px]">
                {sealed ? "You're in." : "Check your email."}
              </h1>
              <p className="text-[17px] text-muted-foreground">
                {sealed ? (
                  "Opening Tegata…"
                ) : (
                  <>
                    Enter the code we sent to{" "}
                    <span className="font-semibold text-foreground">{email.trim()}</span>
                  </>
                )}
              </p>
            </div>
            <CodeField value={code} state={codeState} onChange={onCode} onComplete={onSubmitCode} />
            <div className="flex h-6 items-center gap-2 text-[15px]" aria-live="polite">
              {codeState === "checking" ? (
                <>
                  <Spinner className="text-muted-foreground" />
                  <span className="text-muted-foreground">Checking the code…</span>
                </>
              ) : problem ? (
                <span className="font-medium text-down">{problem}</span>
              ) : sealed ? null : resendIn > 0 ? (
                <span className="tnum text-text-3">Send a new code in {resendIn} s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onRequestCode()}
                  className="font-semibold text-shu-ink hover:underline"
                >
                  Send a new code
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}
