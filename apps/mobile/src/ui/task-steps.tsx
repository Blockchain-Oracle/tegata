// Named stages while something happens on NEAR (Portrait with Privy, Fuse): done steps tick, the current one breathes
// with elapsed seconds after 3 s, the rest wait. Each landing plays `step` once.
import { Check } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import { View } from "react-native"
import Animated, { FadeInDown } from "react-native-reanimated"

import { fire } from "@/feedback/fire"
import { SHU, usePalette } from "@/theme/tokens"

import { Shimmer } from "./shimmer"
import { T } from "./text"

export function useElapsed(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!running) return
    setSeconds(0)
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [running])
  return seconds
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

export function TaskSteps({
  steps,
  current,
  failed,
  onDark,
}: {
  steps: string[]
  /** Index of the step in progress; steps.length when all are done. */
  current: number
  failed?: boolean
  /** On the stage: white text. */
  onDark?: boolean
}) {
  const p = usePalette()
  const elapsed = useElapsed(current < steps.length && !failed)
  const last = useRef(current)
  useEffect(() => {
    if (current > last.current) fire("tick", { cue: "step" })
    last.current = current
  }, [current])
  const ink = onDark ? "#FFFFFF" : p.ink
  const quiet = onDark ? "#FFFFFFB3" : p.text3
  return (
    <View style={{ gap: 14 }}>
      {steps.map((label, i) => {
        const done = i < current
        const now = i === current && !failed
        return (
          <Animated.View
            key={label}
            entering={FadeInDown.delay(i * 40).duration(320)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: done ? (onDark ? "#FFFFFF" : SHU) : "transparent",
                borderWidth: done ? 0 : 2,
                borderColor: now ? (onDark ? "#FFFFFF" : SHU) : quiet,
                borderStyle: now ? "dashed" : "solid",
              }}
            >
              {done ? <Check size={16} color={onDark ? SHU : "#000"} strokeWidth={3} /> : null}
            </View>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              {now ? (
                <Shimmer color={ink}>{label}</Shimmer>
              ) : (
                <T role="rowTitle" color={done ? ink : quiet}>
                  {label}
                </T>
              )}
              {now && elapsed >= 3 ? (
                <T role="detailMedium" color={quiet}>
                  {elapsed >= 15 ? `Still on NEAR · ${clock(elapsed)}` : clock(elapsed)}
                </T>
              ) : null}
            </View>
          </Animated.View>
        )
      })}
    </View>
  )
}
