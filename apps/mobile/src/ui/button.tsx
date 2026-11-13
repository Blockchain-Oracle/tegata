// Buttons (DESIGN.md: 56 high, radius 12, never a full pill). Primary is the one main action: black on light, paper on
// dark. A button doing work never looks disabled: its face names the phase with a shimmer.
import type { ReactNode } from "react"
import { ActivityIndicator, type StyleProp, View, type ViewStyle } from "react-native"

import type { Cue } from "@/feedback/fire"
import { PAPER, RADIUS, SHU, usePalette } from "@/theme/tokens"

import { Press } from "./press"
import { Shimmer } from "./shimmer"
import { T } from "./text"

type Variant = "primary" | "secondary" | "white" | "seal"

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  busy,
  busyLabel,
  disabled,
  size = "large",
  cue = "tap",
  style,
}: {
  label: string
  onPress?: () => void
  variant?: Variant
  icon?: ReactNode
  busy?: boolean
  busyLabel?: string
  disabled?: boolean
  size?: "large" | "medium" | "compact"
  cue?: Cue | null
  style?: StyleProp<ViewStyle>
}) {
  const p = usePalette()
  const height = size === "large" ? 56 : size === "medium" ? 48 : 40
  const colors: Record<Variant, { bg: string; fg: string }> = {
    primary: { bg: p.primary, fg: p.onPrimary },
    secondary: { bg: p.plate, fg: p.ink },
    white: { bg: PAPER.face, fg: PAPER.ink },
    seal: { bg: SHU, fg: PAPER.ink },
  }
  const { bg, fg } = disabled && !busy ? { bg: p.plate, fg: p.text3 } : colors[variant]
  return (
    <Press
      onPress={busy ? undefined : onPress}
      disabled={disabled}
      dim={false}
      cue={busy || cue === null ? undefined : cue}
      accessibilityLabel={busy && busyLabel ? busyLabel : label}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }}
      style={[
        {
          height,
          borderRadius: size === "compact" ? 10 : RADIUS.button,
          backgroundColor: bg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingHorizontal: 20,
        },
        style,
      ]}
    >
      {busy ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="small" color={fg} />
          <Shimmer color={fg}>{busyLabel ?? label}</Shimmer>
        </View>
      ) : (
        <>
          {icon}
          <T role={size === "compact" ? "detailMedium" : "rowTitle"} color={fg}>
            {label}
          </T>
        </>
      )}
    </Press>
  )
}
