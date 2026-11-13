// Public configuration, read once. Every id here is safe to ship in the app (the web ships the same app id).
import Constants from "expo-constants"

/** Tegata's API and public pages: the same server the web app uses. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://tegata.xyz").replace(/\/$/, "")

/** Privy: the app id and the mobile app client (dashboard → App clients; allowed id xyz.tegata.app, scheme tegata). */
export const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "cmwddg99502ur0gkw0h3c80bo"
export const PRIVY_CLIENT_ID =
  process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? "client-WY6fitJM2cvnMuxfyBywkJ3vp9VB26jbC8LU6s9XSuAyK"

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0"

/** The USDC contract on each network (Circle's native USDC, NEP-141); mirrors @tegata/config NETWORKS. */
export { MODE_LABEL, NETWORKS, USDC_DECIMALS } from "@tegata/config"
