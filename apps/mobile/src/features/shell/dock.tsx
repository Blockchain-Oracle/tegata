// The floating dock (Kawase's dock, plan 6.7 phone): Home · Links · ＋ · Activity · You. Radius 40, the only shadowed
// chrome; the active bubble springs (420/30) under the icon with a tick. "＋" fans out Send, Pay link, Scan and Payroll
// as white circles over a scrim, with the sheet cue.
import { router, type Tabs } from "expo-router"
import { Activity, Banknote, Home, Link2, Plus, ScanLine, Send, X } from "lucide-react-native"
import { type ComponentProps, type ReactNode, useEffect, useState } from "react"
import { Modal, Pressable, View } from "react-native"
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  ZoomIn,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useSession } from "@/auth/session"
import { fire } from "@/feedback/fire"
import { SHADOW, SHU, SPRING, usePalette } from "@/theme/tokens"
import { Press } from "@/ui/press"
import { BusinessSeal } from "@/ui/seal"
import { T } from "@/ui/text"

const SLOT = 64

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0]

const TABS: Record<string, { label: string; icon: (color: string) => ReactNode }> = {
  index: { label: "Home", icon: (c) => <Home size={24} color={c} strokeWidth={2} /> },
  links: { label: "Links", icon: (c) => <Link2 size={24} color={c} strokeWidth={2} /> },
  activity: { label: "Activity", icon: (c) => <Activity size={24} color={c} strokeWidth={2} /> },
}

export function Dock({ state, navigation }: BottomTabBarProps) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const { profile } = useSession()
  const [fan, setFan] = useState(false)
  const routes = state.routes
  // Slot order: two tabs, the "+", then the rest.
  const slots: (string | "+")[] = [routes[0]?.name ?? "index", routes[1]?.name ?? "links", "+", routes[2]?.name ?? "activity", routes[3]?.name ?? "you"]
  const activeName = routes[state.index]?.name
  const activeSlot = Math.max(0, slots.indexOf(activeName ?? "index"))
  const bubble = useSharedValue(activeSlot * SLOT)
  useEffect(() => {
    bubble.value = withSpring(activeSlot * SLOT, SPRING.dock)
  }, [activeSlot, bubble])
  const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: bubble.value }] }))

  return (
    <>
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 12) + 4, alignItems: "center" }}
      >
        <View
          style={[
            { flexDirection: "row", padding: 6, borderRadius: 40, backgroundColor: p.card },
            SHADOW.dock,
          ]}
        >
          <Animated.View
            style={[
              { position: "absolute", left: 6, top: 6, width: SLOT, height: 56, borderRadius: 28, backgroundColor: p.plate },
              bubbleStyle,
            ]}
          />
          {slots.map((name) => {
            if (name === "+")
              return (
                <Press
                  key="plus"
                  haptic={null}
                  accessibilityLabel="New"
                  onPress={() => {
                    fire("press", { cue: "sheetOpen" })
                    setFan(true)
                  }}
                  style={{ width: SLOT, height: 56, alignItems: "center", justifyContent: "center" }}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: p.primary, alignItems: "center", justifyContent: "center" }}>
                    <Plus size={26} color={p.onPrimary} strokeWidth={2.4} />
                  </View>
                </Press>
              )
            const index = routes.findIndex((r) => r.name === name)
            const focused = state.index === index
            const color = focused ? p.ink : p.text3
            return (
              <Press
                key={name}
                haptic="tick"
                scaleTo={0.92}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={name === "you" ? "You" : TABS[name]?.label}
                onPress={() => {
                  const route = routes[index]
                  if (!route) return
                  const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
                }}
                style={{ width: SLOT, height: 56, alignItems: "center", justifyContent: "center", gap: 2 }}
              >
                {name === "you" ? (
                  <View style={{ opacity: focused ? 1 : 0.85 }}>
                    <BusinessSeal name={profile?.workspace?.name ?? "You"} size={30} tilt={0} />
                  </View>
                ) : (
                  TABS[name]?.icon(color)
                )}
                <T role="meta" color={color} style={{ fontSize: 11, lineHeight: 13 }}>
                  {name === "you" ? "You" : TABS[name]?.label}
                </T>
              </Press>
            )
          })}
        </View>
      </View>
      <Fan open={fan} onClose={() => setFan(false)} bottom={Math.max(insets.bottom, 12) + 84} />
    </>
  )
}

const FAN = [
  { label: "Send", icon: Send, href: "/send" },
  { label: "Pay link", icon: Link2, href: "/links/new" },
  { label: "Scan", icon: ScanLine, href: "/scan" },
  { label: "Payroll", icon: Banknote, href: "/payroll" },
] as const

function Fan({ open, onClose, bottom }: { open: boolean; onClose: () => void; bottom: number }) {
  const close = () => {
    fire("tick", { cue: "sheetClose" })
    onClose()
  }
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      {open ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} style={{ flex: 1, backgroundColor: "#000000B3" }}>
          <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" />
          <View style={{ position: "absolute", left: 0, right: 0, bottom, alignItems: "center", gap: 22 }}>
            <View style={{ flexDirection: "row", gap: 18 }}>
              {FAN.map((item, i) => (
                <FanItem
                  key={item.label}
                  index={i}
                  label={item.label}
                  icon={<item.icon size={26} color="#000" strokeWidth={2} />}
                  onPress={() => {
                    onClose()
                    fire("press")
                    router.push(item.href)
                  }}
                />
              ))}
            </View>
            <Press
              haptic={null}
              accessibilityLabel="Close"
              onPress={close}
              style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: SHU, alignItems: "center", justifyContent: "center", marginTop: 6 }}
            >
              <X size={26} color="#000" strokeWidth={2.4} />
            </Press>
          </View>
        </Animated.View>
      ) : null}
    </Modal>
  )
}

function FanItem({ label, icon, onPress, index }: { label: string; icon: ReactNode; onPress: () => void; index: number }) {
  const rise = useSharedValue(24)
  useEffect(() => {
    rise.value = withDelay(index * 40, withSpring(0, SPRING.layout))
  }, [index, rise])
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }] }))
  return (
    <Animated.View entering={ZoomIn.delay(index * 40).springify()} style={style}>
      <Press haptic="tick" onPress={onPress} accessibilityLabel={label} style={{ alignItems: "center", gap: 8, width: 68 }}>
        <View style={[{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, SHADOW.object]}>
          {icon}
        </View>
        <T role="detailMedium" tone="white">
          {label}
        </T>
      </Press>
    </Animated.View>
  )
}
