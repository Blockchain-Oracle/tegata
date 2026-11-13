// Hold to confirm (21st ddoemonn/hold-to-confirm, on the phone): the approval for money. Press and hold; a vermilion fill
// sweeps across in 700 ms with light ticks, and at the end a firm `confirm` haptic fires and the action runs. Let go
// early and the fill runs back: nothing happens. While the action runs, the face names the phase.
import { useRef, useState } from "react"
import { ActivityIndicator, Pressable, type StyleProp, View, type ViewStyle } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { fire } from "@/feedback/fire"
import { RADIUS, SHU, usePalette } from "@/theme/tokens"

import { Shimmer } from "./shimmer"
import { T } from "./text"

const HOLD_MS = 700
const TICKS = 4

export function HoldButton({
  label,
  onConfirm,
  busy,
  busyLabel,
  disabled,
  disabledReason,
  style,
}: {
  label: string
  onConfirm: () => void
  busy?: boolean
  busyLabel?: string
  disabled?: boolean
  /** Said on the button when it can't be held (e.g. "Not enough in your balance"). */
  disabledReason?: string
  style?: StyleProp<ViewStyle>
}) {
  const p = usePalette()
  const fill = useSharedValue(0)
  const [width, setWidth] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [holding, setHolding] = useState(false)

  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  const done = () => {
    clear()
    setHolding(false)
    fire("confirm")
    onConfirm()
    fill.value = withTiming(0, { duration: 300 })
  }
  const start = () => {
    if (busy || disabled) return
    setHolding(true)
    fire("press")
    for (let i = 1; i < TICKS; i++) timers.current.push(setTimeout(() => fire("tick"), (HOLD_MS / TICKS) * i))
    fill.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(done)()
    })
  }
  const release = () => {
    if (!holding) return
    clear()
    setHolding(false)
    cancelAnimation(fill)
    fill.value = withTiming(0, { duration: 220 })
  }
  const bar = useAnimatedStyle(() => ({ width: fill.value * width }))
  const off = disabled && !busy

  return (
    <Pressable
      onPressIn={start}
      onPressOut={release}
      accessibilityRole="button"
      accessibilityLabel={off && disabledReason ? disabledReason : `Hold to ${label}`}
      accessibilityHint="Press and hold to approve"
      accessibilityState={{ disabled: Boolean(off), busy: Boolean(busy) }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        {
          height: 56,
          borderRadius: RADIUS.button,
          backgroundColor: off ? p.plate : p.primary,
          overflow: "hidden",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: SHU }, bar]} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 16 }}>
        {busy ? (
          <>
            <ActivityIndicator color={p.onPrimary} />
            <Shimmer color={p.onPrimary}>{busyLabel ?? label}</Shimmer>
          </>
        ) : (
          <T role="rowTitle" color={off ? p.text2 : p.onPrimary} numberOfLines={1}>
            {off && disabledReason ? disabledReason : holding ? "Keep holding" : `Hold to ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
          </T>
        )}
      </View>
    </Pressable>
  )
}
