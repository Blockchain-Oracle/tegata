// The mode capsule (Sandbox | Live), one tap, like dark mode. Sandbox wears a dashed rim and its name; Live is solid.
// Live is offered only when the server has it switched on; otherwise the capsule opens You, where the reason is said.
import { router } from "expo-router"
import { View } from "react-native"

import { useSession } from "@/auth/session"
import { fire } from "@/feedback/fire"
import { RADIUS, SHU, usePalette } from "@/theme/tokens"

import { Press } from "./press"
import { T } from "./text"

export function ModeCapsule() {
  const p = usePalette()
  const { mode, setMode, profile } = useSession()
  const liveOn = profile?.networks.includes("mainnet") ?? false
  const sandbox = mode === "sandbox" || !liveOn
  return (
    <Press
      haptic={null}
      accessibilityLabel={sandbox ? "Sandbox mode. Switch to Live" : "Live mode. Switch to Sandbox"}
      onPress={() => {
        fire("tick", { cue: "toggle" })
        if (!liveOn) return router.push("/you")
        setMode(sandbox ? "live" : "sandbox")
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 32,
        paddingHorizontal: 12,
        borderRadius: RADIUS.pill,
        borderWidth: 1.5,
        borderStyle: sandbox ? "dashed" : "solid",
        borderColor: sandbox ? p.text3 : p.ink,
        backgroundColor: sandbox ? "transparent" : p.ink,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sandbox ? p.text3 : SHU }} />
      <T role="detailMedium" color={sandbox ? p.ink : p.page}>
        {sandbox ? "Sandbox" : "Live"}
      </T>
    </Press>
  )
}
