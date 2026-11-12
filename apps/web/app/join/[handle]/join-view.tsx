"use client"

// The join link (plan 6.8 H): "Studio Kaze invited you", the reward in plain words with the rule of this network,
// and one button. The invite is kept on this device and attached when the account is opened.
import { ArrowRight, Gift } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { BusinessSeal, TegataSeal } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { viewDollars } from "@/components/kit/figure"
import { Paper, Stage } from "@/components/kit/stage"
import { MarkStack } from "@/components/marks/mark"
import { rememberInvite } from "@/lib/client/referral"
import { fire } from "@/lib/feedback"

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
  const reward = `$${viewDollars(p.reward).toFixed(0)}`
  const threshold = `$${viewDollars(p.threshold).toFixed(0)}`
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 pt-6 pb-10 sm:pt-12">
        <Stage className="px-6 pt-8 pb-8">
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
              Get paid and pay your team in exact dollars on NEAR: invoices, pay links and payroll.
              Sign in with email; Tegata pays every network fee.
            </p>
            <MarkStack ids={["usdc", "near"]} size={28} />
          </div>
        </Stage>

        <Paper className="flex items-start gap-4 p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-kin text-black">
            <Gift className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[17px] font-semibold">You both get {reward}</span>
            <span className="text-[14px] text-[#666]">
              Once your business receives {threshold} from customers in its first {p.windowDays}{" "}
              days, you and {p.business} each get {reward} in USDC
              {p.sandbox ? " (test USDC: this is the Sandbox)" : ""}.
            </span>
          </div>
        </Paper>

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
          <TegataSeal size={14} textured={false} tilt={0} /> Email sign-in · no wallet · no fees to
          think about
        </span>
      </div>
    </div>
  )
}
