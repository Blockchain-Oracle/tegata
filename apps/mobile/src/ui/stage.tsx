// The stage (plan 6.2): a lit vermilion field with two lights, soft white light and fine grain, where white product
// objects float. It stays lit in dark mode. Drawn with react-native-svg gradients; the grain is a tiled noise texture.
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
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg"

import { RADIUS, SHADOW, SPRING, STAGE } from "@/theme/tokens"

const GRAIN = require("../../assets/brand/grain.png")

const LIGHTS = {
  shu: STAGE,
  paid: { base: "#2F7A00", hot: "#4FA81C", glow: "#8FD94E", edge: "#236000" },
} as const

export function StageField({ tone = "shu" }: { tone?: keyof typeof LIGHTS }) {
  const light = LIGHTS[tone]
  const [size, setSize] = useState({ width: 0, height: 0 })
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: light.base }]}
      pointerEvents="none"
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <Svg width={size.width} height={size.height} preserveAspectRatio="none" viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
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
        <Rect width="100" height="100" fill={light.base} />
        <Rect width="100" height="100" fill="url(#hot)" />
        <Rect width="100" height="100" fill="url(#glow)" />
        <Rect width="100" height="100" fill="url(#edge)" />
        <Rect width="100" height="100" fill="url(#white)" />
      </Svg>
      <Image source={GRAIN} resizeMode="repeat" style={{ position: "absolute", top: 0, left: 0, width: size.width, height: size.height, opacity: 0.16 }} />
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
  tone?: keyof typeof LIGHTS
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
    enter.value = reduce ? withTiming(1, { duration: 100 }) : withDelay(delay, withSpring(1, SPRING.layout))
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

/** The white paper card objects are made of. */
export function Paper({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: "#FFFFFF", borderRadius: RADIUS.group }, SHADOW.object, style]}>{children}</View>
}
