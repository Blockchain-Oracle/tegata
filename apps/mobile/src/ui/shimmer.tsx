// A short verb that breathes while something is happening ("Opening your account"), and the skeleton block that
// stands where data will land (opacity 0.65 ↔ 1 over 1200 ms; still under reduced motion).
import { useEffect } from "react"
import type { DimensionValue, StyleProp, ViewStyle } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

import { MOTION, RADIUS, usePalette } from "@/theme/tokens"

import { T } from "./text"

function useBreath(low: number) {
  const reduce = useReducedMotion()
  const value = useSharedValue(1)
  useEffect(() => {
    if (reduce) return
    value.value = withRepeat(
      withTiming(low, { duration: MOTION.skeleton / 2, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
  }, [reduce, value, low])
  return useAnimatedStyle(() => ({ opacity: value.value }))
}

export function Shimmer({ children, color }: { children: string; color?: string }) {
  const style = useBreath(0.45)
  return (
    <Animated.View style={style}>
      <T role="rowTitle" color={color}>
        {children}
      </T>
    </Animated.View>
  )
}

export function Skeleton({
  width,
  height,
  radius = RADIUS.chip,
  style,
  light,
}: {
  width: DimensionValue
  height: number
  radius?: number
  style?: StyleProp<ViewStyle>
  /** On the stage: a white wash instead of the grey plate. */
  light?: boolean
}) {
  const p = usePalette()
  const breath = useBreath(0.65)
  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[
        { width, height, borderRadius: radius, backgroundColor: light ? "#FFFFFF40" : p.skeleton },
        breath,
        style,
      ]}
    />
  )
}
