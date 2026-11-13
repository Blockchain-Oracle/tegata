// The status bar's ink, set imperatively so the screen in front always wins: light over a stage (sign-in, account
// opening), otherwise the scheme's own (sumi on washi by day, washi on sumi at night).
import { useFocusEffect } from "expo-router"
import { setStatusBarStyle } from "expo-status-bar"
import { useCallback } from "react"
import { useColorScheme } from "react-native"

export function useStatusBar(over: "stage" | "page") {
  const scheme = useColorScheme()
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(over === "stage" || scheme === "dark" ? "light" : "dark", true)
    }, [over, scheme]),
  )
}
