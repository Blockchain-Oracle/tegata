"use client"

// The welcome flow's look (plan 6.8 B), separate from its logic so /dev/flows can show every state.
// 1 "What's your business called?" → 2 "Your pay address." → 3 "Opening your account." → open.
import { ArrowLeft, ArrowRight, Clock3, Stamp } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/kit/button"
import { Field, type FieldStatus } from "@/components/kit/field"
import { ErrorState, WaitingText } from "@/components/kit/states"
import type { TaskStep } from "@/components/kit/task-steps"
import { BillStage, type WelcomeStage } from "@/components/onboarding/bill-stage"
import { cn } from "@/lib/utils"

export interface WelcomeViewProps {
  stage: WelcomeStage
  name: string
  onName: (value: string) => void
  handle: string
  onHandle: (value: string) => void
  suffix: string
  handleStatus: FieldStatus
  timezone: string
  canContinue: boolean
  canOpen: boolean
  opening: boolean
  openError: string | null
  setupStartedAt: number
  steps: readonly TaskStep[]
  current: number
  failed: boolean
  onNext: () => void
  onBack: () => void
  onOpen: () => void
  onRetry: () => void
  onDone: () => void
}

const ORDER: WelcomeStage[] = ["name", "handle", "opening", "open"]

export function WelcomeView(p: WelcomeViewProps) {
  const reduce = useReducedMotion()
  const position = Math.min(3, ORDER.indexOf(p.stage) + 1)
  const slide = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, x: -24 },
    transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] as const },
  }

  return (
    <AuthShell
      stage={
        <BillStage
          stage={p.stage}
          name={p.name}
          accountId={`${p.handle || "your-name"}${p.suffix}`}
          steps={p.steps}
          current={p.current}
          failed={p.failed}
        />
      }
      top={
        <div className="flex items-center gap-3">
          {p.stage === "handle" ? (
            <button
              type="button"
              aria-label="Back"
              onClick={p.onBack}
              className="press grid size-10 place-items-center rounded-full bg-secondary hover:bg-plate-pressed"
            >
              <ArrowLeft className="size-4" />
            </button>
          ) : null}
          <div
            className="flex items-center gap-1.5"
            role="img"
            aria-label={`Step ${position} of 3`}
          >
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i <= position ? "w-8 bg-shu" : "w-4 bg-plate-pressed",
                )}
              />
            ))}
          </div>
          <span className="tnum text-meta font-semibold text-text-3">{position} of 3</span>
        </div>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {p.stage === "name" ? (
          <motion.form
            key="name"
            className="flex flex-col gap-7"
            onSubmit={(e) => {
              e.preventDefault()
              if (p.canContinue) p.onNext()
            }}
            {...slide}
          >
            <h1 className="display text-[44px] leading-[0.95] sm:text-[56px]">
              What's your business called?
            </h1>
            <Field
              id="business"
              aria-label="Business name"
              placeholder="Studio Kaze"
              value={p.name}
              onChange={(e) => p.onName(e.target.value)}
              maxLength={60}
              autoFocus
              big
              autoComplete="organization"
            />
            <p className="-mt-3 text-detail text-text-3">
              It goes on your invoices, receipts and your seal.
            </p>
            <Button type="submit" cue="tap" disabled={!p.canContinue}>
              Continue <ArrowRight />
            </Button>
          </motion.form>
        ) : p.stage === "handle" ? (
          <motion.form
            key="handle"
            className="flex flex-col gap-7"
            onSubmit={(e) => {
              e.preventDefault()
              if (p.canOpen) p.onOpen()
            }}
            {...slide}
          >
            <div className="flex flex-col gap-3">
              <h1 className="display text-[44px] leading-[0.95] sm:text-[56px]">
                Your pay address.
              </h1>
              <p className="text-[17px] text-muted-foreground">
                A name on NEAR anyone can pay, from any chain.
              </p>
            </div>
            <Field
              id="handle"
              aria-label="Pay address"
              value={p.handle}
              onChange={(e) => p.onHandle(e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
              autoFocus
              big
              status={p.handleStatus}
              reserveStatus
              className="font-mono"
              trailing={
                <span className="shrink-0 font-mono text-[17px] text-text-3">{p.suffix}</span>
              }
            />
            <div className="flex items-center justify-between rounded-[14px] bg-card px-4 py-3 text-[15px]">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Clock3 className="size-4" /> Time zone
              </span>
              <span className="font-semibold">{p.timezone.replace(/_/g, " ")}</span>
            </div>
            {p.openError ? (
              <p className="text-[15px] font-medium text-down">{p.openError}</p>
            ) : null}
            <Button type="submit" cue="tap" busy={p.opening} disabled={!p.canOpen}>
              Open my account <Stamp />
            </Button>
          </motion.form>
        ) : p.stage === "opening" ? (
          <motion.div key="opening" className="flex flex-col gap-6" {...slide}>
            <h1 className="display text-[44px] leading-[0.95] sm:text-[56px]">
              Opening your account.
            </h1>
            {p.failed ? (
              <ErrorState
                title="Your account isn't open yet"
                detail="NEAR didn't confirm in time."
                stillWorks="Nothing was charged and your name is kept."
                onRetry={p.onRetry}
              />
            ) : (
              <>
                <WaitingText
                  verb="Working on NEAR"
                  startedAt={p.setupStartedAt}
                  onRetry={p.onRetry}
                  className="text-[17px]"
                />
                <p className="text-[15px] text-muted-foreground">
                  Tegata creates your account on NEAR and pays the network fee. It takes a few
                  seconds.
                </p>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="open" className="flex flex-col gap-7" {...slide}>
            <div className="flex flex-col gap-3">
              <h1 className="display text-[44px] leading-[0.95] sm:text-[56px]">
                Your account is open.
              </h1>
              <p className="text-[17px] text-muted-foreground">
                <span className="font-semibold text-foreground">{p.name.trim()}</span> can now get
                paid from any chain.
              </p>
            </div>
            <Button cue="tap" onClick={p.onDone}>
              Open Tegata <ArrowRight />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}
