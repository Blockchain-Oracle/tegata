// The app's frame: gestures, safe areas, Privy + the API session, sound and touch warmed at launch, and one stack.
// Sheets (Get paid, the "+" fan, a scanned code) are native form sheets; the scanner is full screen.

import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useEffect } from "react"
import { useColorScheme } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { AppProviders } from "@/auth/session"
import { warmFeedback } from "@/feedback/fire"
import { usePalette } from "@/theme/tokens"

void SplashScreen.preventAutoHideAsync().catch(() => undefined)

export default function RootLayout() {
  const p = usePalette()
  const scheme = useColorScheme()
  useEffect(() => {
    warmFeedback()
  }, [])
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: p.page }}>
      <SafeAreaProvider>
        <AppProviders>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: p.page },
              animation: "default",
              statusBarStyle: scheme === "dark" ? "light" : "dark",
            }}
          >
            <Stack.Screen name="index" options={{ animation: "none" }} />
            <Stack.Screen
              name="sign-in"
              options={{ animation: "fade", gestureEnabled: false, statusBarStyle: "light" }}
            />
            <Stack.Screen
              name="welcome"
              options={{ animation: "fade", gestureEnabled: false, statusBarStyle: "light" }}
            />
            <Stack.Screen name="(tabs)" options={{ animation: "fade", gestureEnabled: false }} />
            <Stack.Screen
              name="get-paid"
              options={{
                presentation: "formSheet",
                sheetAllowedDetents: [0.86],
                sheetCornerRadius: 24,
                sheetGrabberVisible: true,
                contentStyle: { backgroundColor: p.page },
              }}
            />
            <Stack.Screen
              name="scan"
              options={{
                presentation: "fullScreenModal",
                animation: "fade",
                statusBarStyle: "light",
              }}
            />
            <Stack.Screen name="send" options={{ gestureEnabled: true }} />
          </Stack>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
