// The press every tappable plate shares: to 0.97 in 100 ms, back in 160 ms, with a haptic word on the way down.
// Kawase's plate press, on Reanimated so it runs on the UI thread.
import type { ReactNode } from "react"
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

import { type Cue, fire, type HapticEvent } from "@/feedback/fire"
import { MOTION } from "@/theme/tokens"

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function Press({
  children,
  style,
  haptic = "press",
  cue,
  scaleTo = 0.97,
  onPress,
  disabled,
  dim = true,
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  haptic?: HapticEvent | null
  cue?: Cue
  scaleTo?: number
  /** Fade when disabled (off for parts that draw their own disabled look). */
  dim?: boolean
}) {
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => {
        scale.value = withTiming(scaleTo, { duration: MOTION.pressIn })
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: MOTION.pressOut })
      }}
      onPress={(event) => {
        if (haptic || cue) fire(haptic ?? "press", cue ? { cue } : {})
        onPress?.(event)
      }}
      style={[animated, style, disabled && dim ? { opacity: 0.5 } : null]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  )
}
