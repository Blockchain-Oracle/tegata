"use client"

// The welcome flow's look, separate from its logic so /dev/flows can show every state.
// 1 "What's your business called?" → 2 "Your pay address." → 3 "Opening your account." → open, with the two first
// steps spec B names: add test dollars (Sandbox) and create a pay link.
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Gift,
  Link2,
  Plus,
  Stamp,
  Users,
  X,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button, Spinner } from "@/components/kit/button"
import { Field, type FieldStatus } from "@/components/kit/field"
import { ErrorState, WaitingText } from "@/components/kit/states"
import type { TaskStep } from "@/components/kit/task-steps"
import { Mark } from "@/components/marks/mark"
import type { WelcomeStage } from "@/components/onboarding/bill-stage"
import { DeskStage } from "@/components/onboarding/desk-stage"
import { useTestDollars } from "@/hooks/use-test-dollars"
import { cn } from "@/lib/utils"
import { zoneLabel } from "@/lib/zone"

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
  /** The business whose join link brought this person here, if any. */
  invite?: { business: string } | null
  onDropInvite?: () => void
  /** Set when the person is joining a team's payroll: step 1 asks for their own name. */
  joining?: { business: string; approver?: boolean } | null
  /** Signed in with a NEAR wallet: this account is the pay address, so step 2 shows it instead of a name to pick. */
  walletAccount?: string | null
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
        <DeskStage
          stage={p.stage}
          name={p.name}
          accountId={p.walletAccount ?? `${p.handle || "your-name"}${p.suffix}`}
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
            {p.invite ? (
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-kin py-1 pr-1 pl-3 text-[14px] font-semibold text-field-ink">
                <Gift className="size-4" /> Invited by {p.invite.business}
                <button
                  type="button"
                  aria-label="Remove the invite"
                  onClick={p.onDropInvite}
                  className="grid size-6 place-items-center rounded-full hover:bg-black/10"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ) : null}
            {p.joining ? (
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-matcha px-3 py-1 text-[14px] font-semibold text-field-ink">
                <Users className="size-4" />{" "}
                {p.joining.approver
                  ? `Approving ${p.joining.business}'s payroll`
                  : `Joining ${p.joining.business}'s payroll`}
              </span>
            ) : null}
            <h1 className="display text-[44px] leading-[0.95] sm:text-[56px]">
              {p.joining ? "What should we call you?" : "What's your business called?"}
            </h1>
            <Field
              id="business"
              aria-label={p.joining ? "Your name" : "Business name"}
              placeholder={p.joining ? "Mei Tanaka" : "Studio Kaze"}
              value={p.name}
              onChange={(e) => p.onName(e.target.value)}
              maxLength={60}
              autoFocus
              big
              autoComplete={p.joining ? "name" : "organization"}
            />
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
                {p.walletAccount
                  ? "Your own NEAR account. Payments land there, in USDC."
                  : "A name on NEAR your customers pay."}
              </p>
            </div>
            {p.walletAccount ? (
              <div className="flex items-center gap-3 rounded-[16px] bg-card px-4 py-4">
                <Mark id="near" size={36} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-mono text-[19px] font-semibold">
                    {p.walletAccount}
                  </span>
                  <span className="text-[14px] text-muted-foreground">
                    Signed in with your wallet · nothing new to create
                  </span>
                </span>
              </div>
            ) : (
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
            )}
            <div className="flex items-center justify-between gap-3 rounded-[14px] bg-card px-4 py-3 text-[15px]">
              <span className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
                <Clock3 className="size-4" /> Time zone
              </span>
              <span className="truncate font-semibold">{zoneLabel(p.timezone)}</span>
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
              <WaitingText
                verb="Working on NEAR"
                startedAt={p.setupStartedAt}
                onRetry={p.onRetry}
                className="text-[17px]"
              />
            )}
          </motion.div>
        ) : (
          <motion.div key="open" className="flex flex-col gap-7" {...slide}>
            <div className="flex flex-col gap-3">
              <h1 className="display text-[44px] leading-[0.95] sm:text-[56px]">
                Your account is open.
              </h1>
              <p className="text-[17px] text-muted-foreground">
                <span className="font-semibold text-foreground">{p.name.trim()}</span> can get paid
                in dollars.
              </p>
            </div>
            {p.joining ? null : <FirstSteps sandbox={p.suffix.endsWith(".testnet")} />}
            <Button cue="tap" variant={p.joining ? "primary" : "secondary"} onClick={p.onDone}>
              Open Tegata <ArrowRight />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}

/** Spec B's two first steps, on story fields: test dollars to try paying (Sandbox only) and a first pay link. */
function FirstSteps({ sandbox }: { sandbox: boolean }) {
  const dollars = useTestDollars()
  const tile =
    "press-lift flex min-h-32 flex-col justify-between gap-4 rounded-[20px] p-5 text-left text-field-ink"
  return (
    <div className={cn("grid gap-3", sandbox && "sm:grid-cols-2")}>
      {sandbox ? (
        <button
          type="button"
          onClick={dollars.add}
          disabled={dollars.state === "sending" || dollars.state === "sent"}
          className={cn(tile, "bg-kin disabled:cursor-default")}
        >
          <span className="grid size-11 place-items-center rounded-full bg-field-ink/10 [&_svg]:size-5">
            {dollars.state === "sending" ? (
              <Spinner />
            ) : dollars.state === "sent" ? (
              <Check />
            ) : (
              <Plus />
            )}
          </span>
          <span className="flex flex-col gap-1">
            <span className="display text-[24px] leading-none">
              {dollars.state === "sent" ? "Test dollars added" : "Add test dollars"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[14px] text-field-ink/70">
              <Mark id="usdc" size={16} />
              {dollars.state === "sending"
                ? "Sending $5.00…"
                : dollars.state === "sent"
                  ? "$5.00 in your balance"
                  : dollars.state === "failed"
                    ? (dollars.error ?? "That didn't work. Try again.")
                    : "$5.00 of test USDC"}
            </span>
          </span>
        </button>
      ) : null}
      <Link href="/app/links?new=1" className={cn(tile, "bg-sora")}>
        <span className="grid size-11 place-items-center rounded-full bg-field-ink/10 [&_svg]:size-5">
          <Link2 />
        </span>
        <span className="flex flex-col gap-1">
          <span className="display text-[24px] leading-none">Create a pay link</span>
          <span className="inline-flex items-center gap-1.5 text-[14px] text-field-ink/70">
            <span className="inline-flex -space-x-1">
              {(["usdc", "eth", "sol", "btc"] as const).map((id) => (
                <Mark key={id} id={id} size={16} />
              ))}
            </span>
            Paid from any chain
          </span>
        </span>
      </Link>
    </div>
  )
}
