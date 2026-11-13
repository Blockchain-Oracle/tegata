// The sign-in story on the lit stage (spec S11-M1; the web's StoryStage and Kawase's pager): three scenes built from
// real Tegata objects and real chain marks, auto-advancing with segments that fill linearly, a tap on the left third
// goes back and the right goes on. Every amount carries an "Example" tag, as on the web.
import { Check } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Pressable, View } from "react-native"
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  ZoomIn,
} from "react-native-reanimated"

import { fire } from "@/feedback/fire"
import { PAPER, RADIUS, STORY } from "@/theme/tokens"
import { Figure } from "@/ui/figure"
import { Mark } from "@/ui/mark"
import { BusinessSeal, TegataSeal } from "@/ui/seal"
import { SealPress } from "@/ui/seal-press"
import { Paper, StageObject } from "@/ui/stage"
import { T } from "@/ui/text"

const DWELL_MS = 5200
const SCENES = [
  { key: "link", title: "Send a link. Get paid in exact dollars." },
  { key: "payroll", title: "Pay your whole team in one approval." },
  { key: "receipt", title: "Every payment gets a sealed receipt." },
] as const

function Example() {
  return (
    <View
      style={{
        backgroundColor: PAPER.sunk,
        borderRadius: RADIUS.pill,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <T role="meta" color={PAPER.text2} style={{ fontSize: 11 }}>
        Example
      </T>
    </View>
  )
}

function Segments({ index, paused }: { index: number; paused: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {SCENES.map((scene, i) => (
        <Segment
          key={scene.key}
          state={i < index ? "done" : i === index ? "now" : "next"}
          paused={paused}
        />
      ))}
    </View>
  )
}

function Segment({ state, paused }: { state: "done" | "now" | "next"; paused: boolean }) {
  const fill = useSharedValue(state === "done" ? 1 : 0)
  useEffect(() => {
    if (state === "done") fill.value = 1
    else if (state === "next") fill.value = 0
    else {
      fill.value = 0
      if (!paused) fill.value = withTiming(1, { duration: DWELL_MS, easing: Easing.linear })
      else fill.value = 1
    }
  }, [state, paused, fill])
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }))
  return (
    <View
      style={{
        flex: 1,
        height: 3,
        borderRadius: 2,
        backgroundColor: "#FFFFFF4D",
        overflow: "hidden",
      }}
    >
      <Animated.View style={[{ height: 3, backgroundColor: "#FFFFFF" }, style]} />
    </View>
  )
}

function LinkScene() {
  const [paid, setPaid] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setPaid(true), 1600)
    return () => clearTimeout(t)
  }, [])
  return (
    <StageObject from={{ y: 28, rotate: -3 }}>
      <Paper style={{ width: 280, padding: 18, gap: 10 }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TegataSeal size={18} />
            <T role="detailMedium" color={PAPER.text2}>
              Pay link
            </T>
            <Example />
          </View>
        </View>
        <T role="bodyMedium" color={PAPER.ink}>
          Design sprint · Week 2
        </T>
        <Figure text="$1,250.00" size={46} color={PAPER.ink} />
        <View
          style={{
            height: 38,
            borderRadius: RADIUS.button,
            backgroundColor: paid ? PAPER.upSurface : PAPER.sunk,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
          }}
        >
          <Mark id={paid ? "usdc" : "usdt"} chain={paid ? "near" : "tron"} size={20} />
          <T role="detailMedium" color={paid ? PAPER.up : PAPER.ink}>
            {paid ? "Paid in USDC on NEAR" : "Paying with USDT on Tron"}
          </T>
        </View>
        {paid ? (
          <View style={{ position: "absolute", right: -22, top: -26 }}>
            <SealPress cue={null}>
              <BusinessSeal name="Abu Studio" band="Paid" size={84} />
            </SealPress>
          </View>
        ) : null}
      </Paper>
    </StageObject>
  )
}

const TEAM = [
  { name: "Kemi", tone: STORY.matcha, mark: "usdc", chain: "near", amount: "$1,800.00" },
  { name: "Tomás", tone: STORY.sora, mark: "usdc", chain: "base", amount: "$1,450.00" },
  { name: "Aiko", tone: STORY.sakura, mark: "usdt", chain: "tron", amount: "$2,100.00" },
] as const

function PayrollScene() {
  const [paid, setPaid] = useState(0)
  useEffect(() => {
    const timers = [1200, 1600, 2000].map((ms, i) => setTimeout(() => setPaid(i + 1), ms))
    return () => timers.forEach(clearTimeout)
  }, [])
  return (
    <StageObject from={{ y: 28, rotate: 2 }}>
      <Paper style={{ width: 290, padding: 18, gap: 6 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <T role="detailMedium" color={PAPER.text2}>
            Payroll · November
          </T>
          <Example />
        </View>
        {TEAM.map((person, i) => (
          <View
            key={person.name}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 36 }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: person.tone,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T role="meta" color={PAPER.ink} style={{ fontSize: 13 }}>
                {person.name[0]}
              </T>
            </View>
            <T role="bodyMedium" color={PAPER.ink} style={{ flex: 1 }}>
              {person.name}
            </T>
            <Mark id={person.mark} chain={person.chain} size={20} />
            <T
              role="bodyMedium"
              color={PAPER.ink}
              style={{ width: 82, textAlign: "right", fontVariant: ["tabular-nums"] }}
            >
              {person.amount}
            </T>
            <View style={{ width: 20, alignItems: "center" }}>
              {i < paid ? (
                <Animated.View
                  entering={ZoomIn.springify()}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: PAPER.up,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={12} color={PAPER.face} strokeWidth={3} />
                </Animated.View>
              ) : null}
            </View>
          </View>
        ))}
        <View
          style={{
            height: 44,
            borderRadius: RADIUS.button,
            backgroundColor: PAPER.ink,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 6,
          }}
        >
          <T role="detailMedium" color={PAPER.face}>
            {paid === 3 ? "Paid · one transaction on NEAR" : "Hold to pay 3 people"}
          </T>
        </View>
      </Paper>
    </StageObject>
  )
}

function ReceiptScene() {
  return (
    <StageObject from={{ y: 28, rotate: -2 }}>
      <Paper style={{ width: 280, padding: 18, gap: 8 }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <T role="detailMedium" color={PAPER.text2}>
            Receipt · No. 0042
          </T>
          <Example />
        </View>
        <Figure text="+$480.00" size={40} color={PAPER.up} />
        {[
          ["From", "0x9a3…41c on Base"],
          ["To", "studio.tegata.near"],
          ["Network fee", "Paid by Tegata"],
        ].map(([label, value]) => (
          <View key={label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T role="detail" color={PAPER.text2}>
              {label}
            </T>
            <T role="detailMedium" color={PAPER.ink}>
              {value}
            </T>
          </View>
        ))}
        <View style={{ position: "absolute", right: -18, bottom: -22 }}>
          <SealPress delay={900} cue={null}>
            <BusinessSeal name="Abu Studio" band="Paid" size={80} />
          </SealPress>
        </View>
      </Paper>
    </StageObject>
  )
}

export function StoryStage({ height }: { height: number }) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => setIndex((i) => (i + 1) % SCENES.length), DWELL_MS)
    return () => clearTimeout(t)
  }, [index, reduce])
  const go = (next: number) => {
    fire("tick", { cue: "scene" })
    setIndex((next + SCENES.length) % SCENES.length)
  }
  const scene = SCENES[index] ?? SCENES[0]
  return (
    <View style={{ height }}>
      <View style={{ flex: 1, paddingHorizontal: 20, gap: 16 }}>
        <Segments index={index} paused={Boolean(reduce)} />
        <Animated.View
          key={`t-${scene.key}`}
          entering={FadeIn.duration(320)}
          exiting={FadeOut.duration(160)}
        >
          <T role="pageTitle" color="#FFFFFF" style={{ fontSize: 30, lineHeight: 32 }}>
            {scene.title}
          </T>
        </Animated.View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Animated.View
            key={scene.key}
            entering={FadeIn.duration(320)}
            exiting={FadeOut.duration(160)}
          >
            {scene.key === "link" ? (
              <LinkScene />
            ) : scene.key === "payroll" ? (
              <PayrollScene />
            ) : (
              <ReceiptScene />
            )}
          </Animated.View>
        </View>
      </View>
      <View style={{ position: "absolute", inset: 0, flexDirection: "row" }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => go(index - 1)}
          accessibilityLabel="Previous"
        />
        <Pressable style={{ flex: 2 }} onPress={() => go(index + 1)} accessibilityLabel="Next" />
      </View>
    </View>
  )
}
