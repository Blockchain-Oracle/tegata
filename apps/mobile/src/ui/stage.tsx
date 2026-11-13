// The stage (DESIGN.md palette): a lit field with soft light and fine grain, where paper objects float. Two tones:
// `shu`, the vermilion field for money moments (the balance, a send, a pay link, a receipt), and `lacquer`, sumi lit
// by one vermilion glow rising from below with the landing's dot grid, for big surfaces (sign-in, account opening).
// `paid` turns the field green for money arrived. All stay lit in dark mode. Drawn with react-native-svg in real
// pixels (so the dots stay round); the grain is a tiled noise texture.
import { type ReactNode, useEffect, useState } from "react"
import { Image, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import Svg, { Circle, Defs, G, Mask, Pattern, RadialGradient, Rect, Stop } from "react-native-svg"

import { LACQUER, PAPER, RADIUS, SHADOW, SPRING, STAGE } from "@/theme/tokens"

const GRAIN = require("../../assets/brand/grain.png")

const LIGHTS = {
  shu: STAGE,
  paid: { base: "#2F7A00", hot: "#4FA81C", glow: "#8FD94E", edge: "#236000" },
} as const

export type StageTone = keyof typeof LIGHTS | "lacquer"

function LitField({
  tone,
  width,
  height,
}: {
  tone: keyof typeof LIGHTS
  width: number
  height: number
}) {
  const light = LIGHTS[tone]
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="hot" cx="16%" cy="10%" rx="60%" ry="55%">
          <Stop offset="0" stopColor={light.hot} stopOpacity={1} />
          <Stop offset="1" stopColor={light.hot} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glow" cx="55%" cy="105%" rx="70%" ry="60%">
          <Stop offset="0" stopColor={light.glow} stopOpacity={0.9} />
          <Stop offset="1" stopColor={light.glow} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="edge" cx="92%" cy="30%" rx="40%" ry="40%">
          <Stop offset="0" stopColor={light.edge} stopOpacity={0.9} />
          <Stop offset="1" stopColor={light.edge} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="white" cx="35%" cy="-5%" rx="45%" ry="35%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={light.base} />
      <Rect width={width} height={height} fill="url(#hot)" />
      <Rect width={width} height={height} fill="url(#glow)" />
      <Rect width={width} height={height} fill="url(#edge)" />
      <Rect width={width} height={height} fill="url(#white)" />
    </Svg>
  )
}

const DOT_GAP = 22

/** Sumi lit from below: the landing hero's night. One vermilion glow rising behind the objects, a warm rim at the
 * top left, the desk's dot grid fading out to the edges. */
function LacquerField({ width, height }: { width: number; height: number }) {
  const glowR = Math.max(width, height) * 0.95
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient
          id="rise"
          cx={width / 2}
          cy={height + glowR * 0.32}
          r={glowR}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={LACQUER.glow} stopOpacity={1} />
          <Stop offset="0.3" stopColor={LACQUER.glow2} stopOpacity={0.95} />
          <Stop offset="0.52" stopColor={LACQUER.rim} stopOpacity={0.42} />
          <Stop offset="0.72" stopColor={LACQUER.glow} stopOpacity={0.1} />
          <Stop offset="1" stopColor={LACQUER.glow} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="rim" cx="0%" cy="0%" rx="70%" ry="45%">
          <Stop offset="0" stopColor={LACQUER.rim} stopOpacity={0.32} />
          <Stop offset="1" stopColor={LACQUER.rim} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="fade" cx="50%" cy="45%" rx="85%" ry="75%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="0.8" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <Pattern id="dots" width={DOT_GAP} height={DOT_GAP} patternUnits="userSpaceOnUse">
          <Circle cx={DOT_GAP / 2} cy={DOT_GAP / 2} r={1.1} fill="#FFFFFF" fillOpacity={0.16} />
        </Pattern>
        <Mask id="fadeMask" maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <Rect width={width} height={height} fill="url(#fade)" />
        </Mask>
      </Defs>
      <Rect width={width} height={height} fill={LACQUER.base} />
      <Rect width={width} height={height} fill="url(#rise)" />
      <Rect width={width} height={height} fill="url(#rim)" />
      <G mask="url(#fadeMask)">
        <Rect width={width} height={height} fill="url(#dots)" />
      </G>
    </Svg>
  )
}

export function StageField({ tone = "shu" }: { tone?: StageTone }) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const base = tone === "lacquer" ? LACQUER.base : LIGHTS[tone].base
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: base }]}
      pointerEvents="none"
      onLayout={(e) =>
        setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }
    >
      {size.width > 0 ? (
        tone === "lacquer" ? (
          <LacquerField width={size.width} height={size.height} />
        ) : (
          <LitField tone={tone} width={size.width} height={size.height} />
        )
      ) : null}
      <Image
        source={GRAIN}
        resizeMode="repeat"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size.width,
          height: size.height,
          opacity: tone === "lacquer" ? 0.1 : 0.16,
        }}
      />
    </View>
  )
}

export function Stage({
  children,
  style,
  rounded = true,
  tone = "shu",
}: {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  rounded?: boolean
  tone?: StageTone
}) {
  return (
    <View style={[{ overflow: "hidden", borderRadius: rounded ? RADIUS.sheet : 0 }, style]}>
      <StageField tone={tone} />
      {children}
    </View>
  )
}

/** A white object on the stage: springs in, then drifts ±6 px over 8 s. Still under reduced motion. */
export function StageObject({
  children,
  delay = 0,
  drift = true,
  from = { y: 24, rotate: 0 },
  style,
}: {
  children: ReactNode
  delay?: number
  drift?: boolean
  from?: { y?: number; x?: number; rotate?: number }
  style?: StyleProp<ViewStyle>
}) {
  const reduce = useReducedMotion()
  const enter = useSharedValue(0)
  const float = useSharedValue(0)
  useEffect(() => {
    enter.value = reduce
      ? withTiming(1, { duration: 100 })
      : withDelay(delay, withSpring(1, SPRING.layout))
    if (drift && !reduce)
      float.value = withDelay(
        delay + 400,
        withRepeat(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }), -1, true),
      )
  }, [reduce, delay, drift, enter, float])
  const animated = useAnimatedStyle(() => {
    const t = 1 - enter.value
    return {
      opacity: Math.min(1, enter.value * 1.4),
      transform: [
        { translateX: (from.x ?? 0) * t },
        { translateY: (from.y ?? 0) * t + (float.value - 0.5) * 12 },
        { rotate: `${(from.rotate ?? 0) * t}deg` },
      ],
    }
  })
  return <Animated.View style={[animated, style]}>{children}</Animated.View>
}

/** The washi paper objects are made of (paper stays paper in dark mode). */
export function Paper({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[{ backgroundColor: PAPER.face, borderRadius: RADIUS.group }, SHADOW.object, style]}
    >
      {children}
    </View>
  )
}
