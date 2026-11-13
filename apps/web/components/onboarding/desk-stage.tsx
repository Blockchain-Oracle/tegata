"use client"

// The welcome stage in 3D (DESIGN.md "The 3D hanko", welcome): the business's own round seal is cut on the hanko's
// face as its name is typed, its bill of exchange lies on the desk, the coins anyone can pay it from orbit, and when
// the account opens the seal presses the bill. The pay-address QR and the opening steps float on paper below.
// Without WebGL, or with reduced motion, the 2D bill stage (bill-stage.tsx) is shown instead.
import { useReducedMotion } from "motion/react"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useRef, useState } from "react"

import { Paper, StageObject } from "@/components/kit/stage"
import { type TaskStep, TaskSteps } from "@/components/kit/task-steps"
import type { HankoScene } from "@/components/landing/hanko/scene"
import { webglAvailable } from "@/components/landing/hanko/webgl"
import { MarkStack } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { PAYER_ROUTES } from "@/lib/routes"
import { cn } from "@/lib/utils"

import { BillStage, type WelcomeStage } from "./bill-stage"

const COINS = PAYER_ROUTES.map((r) => ({ coin: r.coin, chain: r.chainMark }))

export function DeskStage(p: {
  stage: WelcomeStage
  name: string
  accountId: string
  steps: readonly TaskStep[]
  current: number
  failed: boolean
}) {
  const reduce = useReducedMotion()
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<HankoScene | null>(null)
  const [ready, setReady] = useState(false)
  const [flat, setFlat] = useState(false)
  const pressed = useRef(false)
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  // The latest bill, read by the effect that builds the scene without rebuilding it on every keystroke.
  const bill = useRef({ name: p.name, account: p.accountId, date: today, open: p.stage === "open" })
  bill.current = { name: p.name, account: p.accountId, date: today, open: p.stage === "open" }

  useEffect(() => {
    const el = host.current
    if (!el) return
    if (reduce || !webglAvailable()) {
      setFlat(true)
      return
    }
    let cancelled = false
    const css = getComputedStyle(document.documentElement)
    const fonts = {
      sans: css.getPropertyValue("--font-archivo").trim() || "sans-serif",
      mono: css.getPropertyValue("--font-dm-mono").trim() || "monospace",
    }
    import("@/components/landing/hanko/scene").then(async ({ HankoScene }) => {
      if (cancelled) return
      const s = new HankoScene(el, {
        coins: COINS,
        fonts,
        mode: "welcome",
        night: true,
        autoPress: false,
        welcome: bill.current,
        onContact: () => {
          fire("confirm", { cue: "stamp" })
          setTimeout(() => fire("filled", { cue: "celebrate" }), 260)
        },
      })
      scene.current = s
      pressed.current = bill.current.open
      try {
        await s.init()
        if (!cancelled) setReady(true)
      } catch {
        s.dispose()
        if (scene.current === s) scene.current = null
        if (!cancelled) setFlat(true)
      }
    })
    return () => {
      cancelled = true
      scene.current?.dispose()
      scene.current = null
    }
  }, [reduce])

  // The name and address, as they are typed.
  useEffect(() => {
    scene.current?.setWelcome({ name: p.name, account: p.accountId, date: today, open: false })
  }, [p.name, p.accountId, today])

  // The account is open: the seal presses, once.
  useEffect(() => {
    if (p.stage !== "open" || pressed.current || !ready) return
    pressed.current = true
    const t = setTimeout(() => scene.current?.pressSeal(true), 350)
    return () => clearTimeout(t)
  }, [p.stage, ready])

  if (flat) return <BillStage {...p} />

  return (
    <div className="absolute inset-0">
      {/* The 2D bill holds the place while three.js loads, then gives way. */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          ready ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <BillStage {...p} />
      </div>
      <div
        ref={host}
        role="img"
        aria-label={`${p.name.trim() || "Your business"}'s seal over its bill, ${p.accountId}`}
        className={cn(
          "absolute inset-0 transition-opacity duration-700",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
      {ready ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4 sm:bottom-10">
          {p.stage === "handle" ? (
            <StageObject from={{ y: 24, rotate: 3 }} key="handle" drift={false}>
              <Paper className="flex w-[300px] items-center gap-4 p-4 sm:w-[360px]">
                <div className="rounded-[12px] bg-white p-1.5 ring-1 ring-paper-rule">
                  <QRCodeSVG
                    value={`near:${p.accountId}`}
                    size={80}
                    level="M"
                    fgColor="#16130F"
                    bgColor="#FFFFFF"
                    imageSettings={{ src: "/icon.svg", height: 20, width: 20, excavate: true }}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-paper-text-2">
                    Anyone can pay you from
                  </span>
                  <MarkStack ids={["eth", "base", "sol", "btc", "tron", "near"]} size={24} />
                </div>
              </Paper>
            </StageObject>
          ) : p.stage === "opening" ? (
            <StageObject from={{ y: 24 }} key="opening" drift={false}>
              <Paper className="w-[300px] p-2 sm:w-[360px]">
                <TaskSteps steps={p.steps} current={p.current} failed={p.failed} tone="paper" />
              </Paper>
            </StageObject>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
