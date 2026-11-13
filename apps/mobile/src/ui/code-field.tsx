// The six-digit sign-in code (Revolut's pattern): six 52-pt boxes split 3–3, one hidden input underneath so the
// system keyboard, paste and iOS one-time-code autofill all work. The sixth digit submits. A wrong code shakes the row
// (±6 px three times in 300 ms) — the caller bumps `shake`.
import { useEffect, useRef } from "react"
import { Pressable, TextInput, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated"

import { FONT, RADIUS, SHU, usePalette } from "@/theme/tokens"

import { T } from "./text"

const LENGTH = 6

export function CodeField({
  value,
  onChange,
  onComplete,
  shake,
  disabled,
}: {
  value: string
  onChange: (code: string) => void
  onComplete: (code: string) => void
  /** Increment to shake (a wrong code). */
  shake: number
  disabled?: boolean
}) {
  const p = usePalette()
  const input = useRef<TextInput>(null)
  const x = useSharedValue(0)
  useEffect(() => {
    if (shake === 0) return
    const d = 50
    x.value = withSequence(
      withTiming(-6, { duration: d }),
      withTiming(6, { duration: d }),
      withTiming(-6, { duration: d }),
      withTiming(6, { duration: d }),
      withTiming(-6, { duration: d }),
      withTiming(0, { duration: d }),
    )
  }, [shake, x])
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  const box = (i: number) => {
    const char = value[i]
    const active =
      !disabled && (i === value.length || (i === LENGTH - 1 && value.length === LENGTH))
    return (
      <View
        key={i}
        style={{
          width: 48,
          height: 56,
          borderRadius: RADIUS.button,
          backgroundColor: p.plate,
          borderWidth: 2,
          borderColor: active ? SHU : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <T style={{ fontFamily: FONT.semibold, fontSize: 26, lineHeight: 30 }}>{char ?? ""}</T>
      </View>
    )
  }

  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Sign-in code">
      <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, row]}>
        {[0, 1, 2].map(box)}
        <View
          style={{
            width: 10,
            height: 2,
            borderRadius: 1,
            backgroundColor: p.text3,
            marginHorizontal: 2,
          }}
        />
        {[3, 4, 5].map(box)}
      </Animated.View>
      <TextInput
        ref={input}
        value={value}
        autoFocus
        editable={!disabled}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, "").slice(0, LENGTH)
          onChange(digits)
          if (digits.length === LENGTH) onComplete(digits)
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        caretHidden
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      />
    </Pressable>
  )
}
