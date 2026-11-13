// A segmented control (21st ddoemonn/segmented-control): a plate with a thumb that springs (260/30) to the choice,
// with a tick.
import { useState } from "react"
import { View } from "react-native"
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated"

import { RADIUS, SPRING, usePalette } from "@/theme/tokens"

import { Press } from "./press"
import { T } from "./text"

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[]
  value: V
  onChange: (value: V) => void
}) {
  const p = usePalette()
  const [width, setWidth] = useState(0)
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const segment = width / options.length
  const thumb = useAnimatedStyle(() => ({
    width: segment - 4,
    transform: [{ translateX: withSpring(index * segment, SPRING.selector) }],
  }))
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}
      style={{ flexDirection: "row", backgroundColor: p.plate, borderRadius: RADIUS.button, padding: 4, height: 44 }}
      accessibilityRole="tablist"
    >
      {width > 0 ? (
        <Animated.View
          style={[{ position: "absolute", top: 4, left: 6, bottom: 4, borderRadius: 9, backgroundColor: p.card }, thumb]}
        />
      ) : null}
      {options.map((option) => (
        <Press
          key={option.value}
          haptic="tick"
          scaleTo={0.97}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === value }}
          onPress={() => onChange(option.value)}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <T role="detailMedium" tone={option.value === value ? "ink" : "text2"}>
            {option.label}
          </T>
        </Press>
      ))}
    </View>
  )
}
