// Rolling money (the web's NumberFlow, on the phone): each digit is a column of 0–9 that rolls to its value in 260 ms
// on cubic-bezier(0.22, 1, 0.36, 1), in the condensed display cut with tabular figures. Symbols ($ , . + −) sit still.
// Reduced motion: digits swap. Money is formatted once by `usd()`, so the figure always shows cents and grouping.
import { useEffect, useState } from "react"
import { type LayoutChangeEvent, Text, type TextStyle, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { usd } from "@/lib/money"
import { FONT, MOTION, PAPER } from "@/theme/tokens"

const DIGITS = "0123456789"
const EASE = Easing.bezier(0.22, 1, 0.36, 1)

function Digit({
  value,
  size,
  color,
  width,
}: {
  value: number
  size: number
  color: string
  width: number
}) {
  const reduce = useReducedMotion()
  const line = Math.round(size * 1.04)
  const y = useSharedValue(-value * line)
  useEffect(() => {
    y.value = reduce
      ? -value * line
      : withTiming(-value * line, { duration: MOTION.roll, easing: EASE })
  }, [value, line, reduce, y])
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
  const style: TextStyle = {
    fontFamily: FONT.display,
    fontSize: size,
    lineHeight: line,
    color,
    textAlign: "center",
    width,
  }
  return (
    <View style={{ height: line, width, overflow: "hidden" }}>
      <Animated.View style={animated}>
        {DIGITS.split("").map((d) => (
          <Text key={d} style={style} allowFontScaling={false}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  )
}

/** A figure whose digits roll. `units` is USDC base units; `text` draws any pre-formatted string instead. */
export function Figure({
  units,
  text,
  size = 56,
  color = PAPER.ink as string,
  signed = false,
}: {
  units?: bigint | string | null
  text?: string
  size?: number
  color?: string
  signed?: boolean
}) {
  const value = text ?? usd(units ?? 0n, { signed })
  const [digitWidth, setDigitWidth] = useState(0)
  const line = Math.round(size * 1.04)
  const symbol: TextStyle = { fontFamily: FONT.display, fontSize: size, lineHeight: line, color }
  return (
    <View
      style={{ flexDirection: "row", alignItems: "flex-end" }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={value}
    >
      {/* Measure one tabular digit once, so every column has the same width and nothing jumps as digits roll. */}
      <Text
        style={[symbol, { position: "absolute", opacity: 0 }]}
        onLayout={(event: LayoutChangeEvent) =>
          setDigitWidth(Math.ceil(event.nativeEvent.layout.width))
        }
        allowFontScaling={false}
      >
        0
      </Text>
      {digitWidth === 0
        ? null
        : value.split("").map((char, i) =>
            DIGITS.includes(char) ? (
              <Digit
                // biome-ignore lint/suspicious/noArrayIndexKey: keyed by place value (ones, tens…), so a digit column rolls instead of remounting.
                key={`d${value.length - i}`}
                value={Number(char)}
                size={size}
                color={color}
                width={digitWidth}
              />
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: symbols keyed by place, like the digit columns.
              <Text key={`s${value.length - i}`} style={symbol} allowFontScaling={false}>
                {char}
              </Text>
            ),
          )}
    </View>
  )
}
