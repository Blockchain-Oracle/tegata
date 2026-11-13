// Who is at the keyboard, kept only for the referral review flag: a keyed hash of the IP and of a long-lived device
// cookie, never the IP itself. Noted at sign-in and compared when a referral attaches; a match flags the referral for
// a human look and never blocks it.
import { createHmac, randomBytes } from "node:crypto"

import { serverEnv } from "@tegata/env"

import { clientIp } from "./http.ts"

const DEVICE_COOKIE = "tegata-device"
const YEAR_S = 365 * 86_400
const HASH_LENGTH = 22

export interface Seen {
  ipHash: string | null
  deviceHash: string | null
}

/** The request's hashed IP and device, and the Set-Cookie that gives a new device its id (null when it has one). */
export function seenOf(request: Request): { seen: Seen; setCookie: string | null } {
  const secret = serverEnv().SESSION_SECRET
  const existing = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)tegata-device=([\w-]{16,64})/)?.[1]
  const device = existing ?? randomBytes(16).toString("base64url")
  const secure = serverEnv().NODE_ENV === "production" ? "; Secure" : ""
  const setCookie = existing
    ? null
    : `${DEVICE_COOKIE}=${device}; Path=/; Max-Age=${YEAR_S}; SameSite=Lax; HttpOnly${secure}`
  // Without a server secret there is nothing safe to hash with, so nothing is kept.
  if (!secret) return { seen: { ipHash: null, deviceHash: null }, setCookie }
  const hash = (kind: string, value: string) =>
    createHmac("sha256", secret)
      .update(`${kind}:${value}`)
      .digest("base64url")
      .slice(0, HASH_LENGTH)
  return {
    seen: { ipHash: hash("ip", clientIp(request)), deviceHash: hash("device", device) },
    setCookie,
  }
}
