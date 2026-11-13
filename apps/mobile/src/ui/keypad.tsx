// A bare 3×4 keypad for amounts (no key backgrounds, UGLYCASH and Kawase style): digits, a point, and delete. Each key
// ticks. Two decimal places at most; leading zeros collapse; a cap keeps the figure on one line.
import { Delete } from "lucide-react-native"
import { View } from "react-native"

import { usePalette } from "@/theme/tokens"

import { Press } from "./press"
import { T } from "./text"

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const
const MAX_WHOLE_DIGITS = 9

export function nextAmount(current: string, key: (typeof KEYS)[number]): string {
  if (key === "del") return current.slice(0, -1)
  if (key === ".") return current.includes(".") ? current : `${current || "0"}.`
  const [whole = "", fraction] = current.split(".")
  if (fraction !== undefined) return fraction.length >= 2 ? current : `${current}${key}`
  if (whole === "0") return key
  if (whole.length >= MAX_WHOLE_DIGITS) return current
  return `${current}${key}`
}

export function Keypad({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const p = usePalette()
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {KEYS.map((key) => (
        <Press
          key={key}
          haptic="tick"
          scaleTo={0.9}
          accessibilityLabel={key === "del" ? "Delete" : key === "." ? "Point" : key}
          onPress={() => onChange(nextAmount(value, key))}
          onLongPress={key === "del" ? () => onChange("") : undefined}
          style={{ width: "33.333%", height: 64, alignItems: "center", justifyContent: "center" }}
        >
          {key === "del" ? (
            <Delete size={26} color={p.ink} strokeWidth={1.8} />
          ) : (
            <T role="sheetTitle" style={{ fontSize: 30, lineHeight: 34 }}>
              {key}
            </T>
          )}
        </Press>
      ))}
    </View>
  )
}
