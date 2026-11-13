"use client"

// The join link (plan 6.8 H): "Studio Kaze invited you", the reward on a paper card on the stage with the rule of this
// network in one line, three facts, and one button. The invite is kept on this device and attached when the account
// is opened.
import { ArrowRight, Gift, Mail, Zap } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { BusinessSeal, TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { SandboxPill } from "@/components/kit/sandbox-pill"
import { Paper, Stage, StageObject } from "@/components/kit/stage"
import { Mark } from "@/components/marks/mark"
import { rememberInvite } from "@/lib/client/referral"
import { fire } from "@/lib/feedback"
import { usdUnits } from "@/lib/fiat"

export interface JoinViewProps {
  handle: string
  business: string
  threshold: string
  reward: string
  windowDays: number
  sandbox: boolean
}

export function JoinView(p: JoinViewProps) {
  const router = useRouter()
  const reward = usdUnits(p.reward)
  const threshold = usdUnits(p.threshold)
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 pt-6 pb-10 sm:pt-12">
        <Stage className="px-5 pt-8 pb-6 sm:px-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="grid size-24 place-items-center rounded-full bg-white shadow-object">
              <BusinessSeal name={p.business} size={84} tilt={-6} />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-medium text-white/85">
                {p.business} invited you to
              </span>
              <span className="display text-[44px] leading-none text-white">Tegata</span>
            </div>
            <p className="max-w-sm text-[16px] text-white/90">
              Invoices, pay links and payroll in exact dollars.
            </p>
            {p.sandbox ? <SandboxPill tone="stage">Sandbox · test USDC</SandboxPill> : null}
          </div>
          <StageObject className="mt-6" from={{ y: 20, rotate: -2 }} drift={false}>
            <Paper className="flex items-center gap-4 p-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-kin text-black">
                <Gift className="size-6" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[17px] font-semibold">You both get {reward}</span>
                <span className="text-[14px] text-paper-text-2">
                  When your business receives {threshold} in {p.windowDays} days
                </span>
              </div>
            </Paper>
          </StageObject>
        </Stage>

        <ul className="grid grid-cols-3 gap-2 text-center">
          <Fact icon={<Mail />} tone="bg-sora text-black" label="Email sign-in" />
          <Fact icon={<Zap />} tone="bg-matcha text-black" label="No fees" />
          <Fact icon={<Mark id="usdc" chain="near" size={40} />} label="USDC on NEAR" />
        </ul>

        <Button
          variant="shu"
          size="lg"
          cue="tap"
          onClick={() => {
            rememberInvite({ handle: p.handle, business: p.business })
            fire("filled", { cue: "confirmed" })
            router.push("/signin")
          }}
        >
          Open your account <ArrowRight />
        </Button>
        <Link
          href="/"
          className="text-center text-[15px] font-semibold text-muted-foreground hover:text-foreground"
        >
          See how Tegata works
        </Link>
        <span className="flex items-center justify-center gap-1.5 pt-4 text-meta text-muted-foreground">
          <TegataSeal size={14} textured={false} tilt={0} /> Tegata
        </span>
      </div>
    </div>
  )
}

function Fact({ icon, tone, label }: { icon: React.ReactNode; tone?: string; label: string }) {
  return (
    <li className="flex flex-col items-center gap-2 rounded-[16px] bg-card px-2 py-4">
      <span className={`grid size-10 place-items-center rounded-full [&_svg]:size-5 ${tone ?? ""}`}>
        {icon}
      </span>
      <span className="text-[13px] font-semibold">{label}</span>
    </li>
  )
}
