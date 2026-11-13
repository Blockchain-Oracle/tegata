import { Tabs } from "expo-router"

import { Dock } from "@/features/shell/dock"
import { usePalette } from "@/theme/tokens"

export default function TabsLayout() {
  const p = usePalette()
  return (
    <Tabs
      tabBar={(props) => <Dock {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: p.page }, animation: "fade" }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="links" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="you" />
    </Tabs>
  )
}
