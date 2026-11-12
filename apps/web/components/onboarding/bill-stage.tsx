"use client"

// The welcome stage (plan 6.8 B): the person's own objects build live as they answer. The business name types onto
// a bill and its round seal cuts its ring text; the pay address fills a card and its QR assembles; while the account
// opens the steps run on paper; at the end the seal presses onto the bill.
import { motion, useReducedMotion } from "motion/react"
import { QRCodeSVG } from "qrcode.react"

import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { Figure } from "@/components/kit/figure"
import { Paper, StageObject } from "@/components/kit/stage"
import { type TaskStep, TaskSteps } from "@/components/kit/task-steps"
import { Mark, MarkStack } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"

export type WelcomeStage = "name" | "handle" | "opening" | "open"

export function BillStage({
  stage,
  name,
  accountId,
  steps,
  current,
  failed,
}: {
  stage: WelcomeStage
  name: string
  accountId: string
  steps: readonly TaskStep[]
  current: number
  failed: boolean
}) {
  const reduce = useReducedMotion()
  const shown = name.trim() || "Your business"
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })

  return (
    <div className="absolute inset-0 grid place-items-center p-6 pt-16 lg:p-10">
      <div className="relative flex w-full max-w-[420px] origin-center scale-[0.82] flex-col items-center sm:scale-90 lg:scale-100">
        {/* The bill: always present, it gathers everything the person gives us. */}
        <StageObject from={{ y: 30, rotate: -3 }}>
          <Paper className="relative w-[320px] p-6 pb-8 sm:w-[380px]">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#666]">
                <TegataSeal size={20} textured={false} /> Tegata
              </span>
              <span className="text-[12px] font-medium text-[#999]">{today}</span>
            </div>
            <p className="mt-5 text-[12px] font-semibold text-[#999]">Pay to the order of</p>
            <motion.p
              key={shown}
              className="display mt-1 min-h-[44px] truncate pr-24 text-[40px] leading-[1.05]"
              initial={reduce ? false : { opacity: 0.4 }}
              animate={{ opacity: name.trim() ? 1 : 0.28 }}
            >
              {shown}
            </motion.p>
            <div className="mt-3 h-px w-full bg-[#ECECEC]" />
            <div className="mt-4 flex items-center gap-2 pr-24">
              <Mark id="near" size={22} />
              <span className="truncate font-mono text-[14px] font-medium">{accountId}</span>
            </div>
            {stage === "open" ? (
              <div className="mt-4 flex items-end justify-between">
                <div className="flex flex-col">
                  <span className="text-[12px] font-semibold text-[#999]">Balance</span>
                  <Figure value={0} className="text-[36px]" />
                </div>
              </div>
            ) : null}

            {/* The business's own seal, on the paper: drawn live, pressed when the account opens. */}
            <div className="absolute right-4 bottom-4">
              {stage === "open" ? (
                <SealPress
                  onLanded={() => {
                    fire("confirm", { cue: "stamp" })
                    setTimeout(() => fire("filled", { cue: "celebrate" }), 260)
                  }}
                >
                  <BusinessSeal name={shown} band={`Open · ${today}`} size={112} />
                </SealPress>
              ) : (
                <motion.div animate={{ opacity: name.trim() ? 0.95 : 0.3 }}>
                  <BusinessSeal name={shown} size={96} />
                </motion.div>
              )}
            </div>
          </Paper>
        </StageObject>

        {stage === "handle" ? (
          <StageObject delay={0.15} from={{ y: 24, rotate: 3 }} className="mt-10">
            <Paper className="flex w-[300px] items-center gap-4 p-4 sm:w-[360px]">
              <div className="rounded-[12px] bg-white p-1.5 ring-1 ring-[#ECECEC]">
                <QRCodeSVG
                  value={`near:${accountId}`}
                  size={92}
                  level="M"
                  fgColor="#000000"
                  bgColor="#FFFFFF"
                  imageSettings={{ src: "/marks/near.svg", height: 22, width: 22, excavate: true }}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[#666]">
                  Anyone can pay you from
                </span>
                <MarkStack ids={["eth", "base", "sol", "btc", "tron", "near"]} size={24} />
              </div>
            </Paper>
          </StageObject>
        ) : null}

        {stage === "opening" ? (
          <StageObject delay={0.1} from={{ y: 24 }} className="mt-10">
            <Paper className="w-[300px] p-2 sm:w-[360px]">
              <TaskSteps steps={steps} current={current} failed={failed} tone="paper" />
            </Paper>
          </StageObject>
        ) : null}
      </div>
    </div>
  )
}
