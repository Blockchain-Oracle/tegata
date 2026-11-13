// The gate: signed out → sign-in; signed in without a business → welcome (account opening); otherwise → Home.
// While Privy and the profile load, the splash stays up, so nobody sees a flash of the wrong screen.
import { Redirect } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useEffect } from "react"
import { View } from "react-native"

import { useSession } from "@/auth/session"
import { usePalette } from "@/theme/tokens"
import { TegataSeal } from "@/ui/seal"

export default function Gate() {
  const p = usePalette()
  const { ready, authenticated, profile, profileLoading, profileError } = useSession()
  const settled = ready && (!authenticated || !profileLoading || Boolean(profileError))
  useEffect(() => {
    if (settled) void SplashScreen.hideAsync().catch(() => undefined)
  }, [settled])

  if (!settled)
    return (
      <View
        style={{ flex: 1, backgroundColor: p.page, alignItems: "center", justifyContent: "center" }}
      >
        <TegataSeal size={88} />
      </View>
    )
  if (!authenticated) return <Redirect href="/sign-in" />
  if (!profile?.workspace) return <Redirect href="/welcome" />
  return <Redirect href="/(tabs)" />
}
