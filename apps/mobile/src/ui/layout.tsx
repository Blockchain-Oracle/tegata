// Page grammar on the phone: a paper page, groups as white cards (radius 20, no borders, no shadows), rows not boxes,
// a back chevron with the title in display type (no breadcrumbs), and chips that say status in words.
import { router } from "expo-router"
import { ChevronLeft, ChevronRight } from "lucide-react-native"
import { type ReactNode, useState } from "react"
import { RefreshControl, ScrollView, type StyleProp, View, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { fire } from "@/feedback/fire"
import { PAPER, RADIUS, usePalette } from "@/theme/tokens"

import { Press } from "./press"
import { T } from "./text"

/** Room under the content so the floating dock never covers the last row. */
export const DOCK_CLEARANCE = 112

export function Screen({
  children,
  onRefresh,
  dock = false,
  padded = true,
  scroll = true,
  style,
}: {
  children: ReactNode
  /** Pull to refresh: the spinner shows until the returned promise settles. */
  onRefresh?: () => unknown
  /** A tab screen: leave room for the dock. */
  dock?: boolean
  padded?: boolean
  scroll?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const [pulling, setPulling] = useState(false)
  const content: ViewStyle = {
    paddingTop: insets.top + 8,
    paddingBottom: (dock ? DOCK_CLEARANCE : 32) + insets.bottom,
    paddingHorizontal: padded ? 16 : 0,
    gap: 20,
  }
  if (!scroll)
    return <View style={[{ flex: 1, backgroundColor: p.page }, content, style]}>{children}</View>
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.page }}
      contentContainerStyle={[content, style]}
      // The safe area is ours (paddingTop above); iOS adding its own inset as well pushed every page down.
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => {
              fire("snap")
              setPulling(true)
              void Promise.resolve(onRefresh())
                .catch(() => undefined)
                .finally(() => setPulling(false))
            }}
            tintColor={p.text3}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  )
}

export function Header({
  title,
  right,
  back = true,
  onBack,
}: {
  title: string
  right?: ReactNode
  back?: boolean
  /** A step inside one screen: Back goes to the step before instead of leaving. */
  onBack?: () => void
}) {
  const p = usePalette()
  return (
    <View style={{ gap: 8 }}>
      {back ? (
        <Press
          haptic="tick"
          accessibilityLabel="Back"
          onPress={() =>
            onBack ? onBack() : router.canGoBack() ? router.back() : router.replace("/")
          }
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: p.plate,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: -2,
          }}
        >
          <ChevronLeft size={24} color={p.ink} />
        </Press>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <T role="pageTitle" style={{ flex: 1 }} numberOfLines={2}>
          {title}
        </T>
        {right}
      </View>
    </View>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette()
  return (
    <View
      style={[
        { backgroundColor: p.card, borderRadius: RADIUS.group, padding: 4, overflow: "hidden" },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function Row({
  left,
  title,
  meta,
  right,
  onPress,
  chevron,
  mono,
}: {
  left?: ReactNode
  title: string
  meta?: string | ReactNode
  right?: ReactNode
  onPress?: () => void
  chevron?: boolean
  /** The title is an account or a code. */
  mono?: boolean
}) {
  const p = usePalette()
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        minHeight: 60,
      }}
    >
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <T role={mono ? "mono" : "rowTitle"} numberOfLines={1}>
          {title}
        </T>
        {typeof meta === "string" ? (
          <T role="detail" tone="text2" numberOfLines={1}>
            {meta}
          </T>
        ) : (
          meta
        )}
      </View>
      {right}
      {chevron ? <ChevronRight size={18} color={p.text3} /> : null}
    </View>
  )
  if (!onPress) return body
  return (
    <Press haptic="tick" onPress={onPress} scaleTo={0.985} style={{ borderRadius: RADIUS.row }}>
      {body}
    </Press>
  )
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: -8,
      }}
    >
      <T role="sectionTitle">{title}</T>
      {action ? (
        <Press haptic="tick" onPress={onAction} hitSlop={10}>
          <T role="bodyMedium" tone="seal">
            {action}
          </T>
        </Press>
      ) : null}
    </View>
  )
}

type ChipTone = "up" | "down" | "warn" | "quiet" | "seal"

export function Chip({ label, tone = "quiet" }: { label: string; tone?: ChipTone }) {
  const p = usePalette()
  const colors: Record<ChipTone, [string, string]> = {
    up: [p.upSurface, p.up],
    down: [p.downSurface, p.down],
    warn: [p.warnSurface, p.warn],
    quiet: [p.plate, p.text2],
    seal: [p.sealWash, p.sealInk],
  }
  const [bg, fg] = colors[tone]
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: RADIUS.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: "flex-start",
      }}
    >
      <T role="meta" color={fg}>
        {label}
      </T>
    </View>
  )
}

/** "Sandbox" said in words with a dashed rim, never by a hue. */
export function SandboxPill({
  label = "Sandbox · test dollars",
  onStage,
}: {
  label?: string
  onStage?: boolean
}) {
  const p = usePalette()
  return (
    <View
      style={{
        borderRadius: RADIUS.pill,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: onStage ? "#FFFFFFB3" : p.text3,
        paddingHorizontal: 10,
        paddingVertical: 3,
        alignSelf: "flex-start",
      }}
    >
      <T role="meta" color={onStage ? "#FFFFFF" : p.text2}>
        {label}
      </T>
    </View>
  )
}

/** A story-field tile: colour for empty states and next steps, black text, one line and one action. */
export function StoryTile({
  field,
  title,
  line,
  icon,
  action,
  onPress,
}: {
  /** The story field: matcha money arrived, sora pay links, kin payroll, sakura cards. Deep at night. */
  field: "matcha" | "sora" | "sakura" | "kin"
  title: string
  line?: string
  icon?: ReactNode
  action?: string
  onPress?: () => void
}) {
  const p = usePalette()
  return (
    <Press
      onPress={onPress}
      disabled={!onPress}
      haptic="tick"
      scaleTo={0.98}
      style={{
        backgroundColor: p[field],
        borderRadius: RADIUS.group,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: PAPER.face,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T role="rowTitle" color={p.fieldInk}>
          {title}
        </T>
        {line ? (
          <T role="detail" color={`${p.fieldInk}B3`} numberOfLines={2}>
            {line}
          </T>
        ) : null}
      </View>
      {action ? (
        <View
          style={{
            backgroundColor: p.primary,
            borderRadius: RADIUS.pill,
            paddingHorizontal: 14,
            height: 36,
            justifyContent: "center",
          }}
        >
          <T role="detailMedium" color={p.onPrimary}>
            {action}
          </T>
        </View>
      ) : null}
    </Press>
  )
}

/** What went wrong, what still works, and one action. */
export function Problem({
  text,
  action,
  onAction,
}: {
  text: string
  action?: string
  onAction?: () => void
}) {
  const p = usePalette()
  return (
    <View
      style={{
        backgroundColor: p.downSurface,
        borderRadius: RADIUS.row,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <T role="detailMedium" color={p.down} style={{ flex: 1 }}>
        {text}
      </T>
      {action ? (
        <Press haptic="tick" onPress={onAction} hitSlop={8}>
          <T role="detailMedium" color={p.down} style={{ textDecorationLine: "underline" }}>
            {action}
          </T>
        </Press>
      ) : null}
    </View>
  )
}
