"use client"

import { Minus, Play, Plus } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useState } from "react"

import { BusinessSeal, SealPress } from "@/components/brand/seal"
import { Button } from "@/components/kit/button"
import { Figure } from "@/components/kit/figure"
import { Paper, Stage, StageObject } from "@/components/kit/stage"
import { Mark } from "@/components/marks/mark"
import { CUES, type Cue, fire } from "@/lib/feedback"

import { Section, Specimen } from "../dev-chrome"

export default function MotionPage() {
  const [value, setValue] = useState(1250)
  const [press, setPress] = useState(0)
  const [stagger, setStagger] = useState(0)
  const [scene, setScene] = useState(0)
  const reduce = useReducedMotion()

  return (
    <div className="flex flex-col">
      <Section
        title="Rolling figures"
        note="Every changing amount rolls: forward on a rise, back on a fall, 260 ms."
      >
        <Specimen label="Balance">
          <div className="flex flex-wrap items-center gap-6">
            <Figure value={value} className="text-[64px]" />
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                aria-label="Less"
                onClick={() => setValue((v) => Math.max(0, v - 480))}
              >
                <Minus />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                aria-label="More"
                onClick={() => {
                  setValue((v) => v + 1250)
                  fire("filled", { cue: "received" })
                }}
              >
                <Plus />
              </Button>
            </div>
          </div>
        </Specimen>
      </Section>

      <Section
        title="The seal press"
        note="In from above and slightly large, a firm press, then rest. 220 ms with the stamp sound."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Specimen label="Paid">
            <div className="grid h-56 place-items-center">
              <SealPress
                key={press}
                play={press > 0}
                onLanded={() => press > 0 && fire("confirm", { cue: "stamp" })}
              >
                <BusinessSeal name="Abu Studio" band="Paid · 12 Nov" size={170} />
              </SealPress>
            </div>
            <Button variant="primary" onClick={() => setPress((p) => p + 1)}>
              <Play /> Press
            </Button>
          </Specimen>
          <Specimen label="Objects on the stage">
            <Stage className="relative h-64 overflow-hidden">
              <div key={scene} className="absolute inset-0 grid place-items-center">
                <StageObject delay={0.05} from={{ y: 30, rotate: -4 }}>
                  <Paper className="w-60 p-4">
                    <p className="text-meta font-semibold text-[#5B544A]">Pay link · Example</p>
                    <p className="figure mt-1 text-[36px]">$1,250.00</p>
                    <div className="mt-2 flex items-center gap-2 text-[13px] font-semibold text-[#2F7A00]">
                      <Mark id="usdc" chain="base" size={22} /> Paid from Base
                    </div>
                  </Paper>
                </StageObject>
              </div>
            </Stage>
            <Button
              variant="primary"
              onClick={() => {
                setScene((s) => s + 1)
                fire("tick", { cue: "scene" })
              }}
            >
              <Play /> Enter again
            </Button>
          </Specimen>
        </div>
      </Section>

      <Section title="Stagger" note="Rows arrive 40 ms apart, each rising 10 px over 320 ms.">
        <Specimen label="Activity arriving">
          <div key={stagger} className="flex flex-col gap-1">
            {[
              "Paid · Invoice 0042",
              "Paid · Pay link",
              "Payroll · 4 people",
              "Moved out to Base",
            ].map((t, i) => (
              <motion.div
                key={t}
                className="rounded-[14px] bg-secondary px-4 py-3 text-[16px] font-semibold"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {t}
              </motion.div>
            ))}
          </div>
          <Button variant="secondary" onClick={() => setStagger((s) => s + 1)}>
            <Play /> Replay
          </Button>
        </Specimen>
      </Section>

      <Section
        title="Sounds"
        note="Piano for money, short sine sounds for the interface, an industrial thud for the seal. Nothing plays for typing, hover or moving between pages. The first tap on the page unlocks sound."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(Object.keys(CUES) as Cue[]).map((cue) => (
            <button
              key={cue}
              type="button"
              onClick={() => fire("press", { cue })}
              className="press-lift flex items-center gap-3 rounded-[16px] bg-card p-4 text-left"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-shu text-black">
                <Play className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">{CUES[cue].label}</span>
                <span className="font-mono text-meta text-text-3">{cue}</span>
              </span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}
