// The session of someone who signed in with a NEAR wallet. Email sign-in keeps Privy's own token; a
// wallet has none, so after the server checks the wallet's signed message it sets this cookie: the user id and an
// expiry, signed with HMAC-SHA256 under SESSION_SECRET. httpOnly, so page scripts can't read or forge it. A second,
// readable cookie only tells the page to use the wallet session (it carries no identity and grants nothing).
import { createHmac, timingSafeEqual } from "node:crypto"

import { serverEnv } from "@tegata/env"

import { HttpError } from "./http.ts"

export const SESSION_COOKIE = "tegata-session"
/** Readable by the page: "this browser signed in with a wallet". The httpOnly cookie is the proof. */
export const WALLET_FLAG_COOKIE = "tegata-wallet"
const SESSION_DAYS = 30
const DAY_S = 86_400
const NOT_CONFIGURED = 503

function secret(): string {
  const value = serverEnv().SESSION_SECRET
  if (!value) {
    throw new HttpError(
      NOT_CONFIGURED,
      "wallet_signin_not_configured",
      "Signing in with a NEAR wallet isn't set up on this server",
    )
  }
  return value
}

/** Throws a 503 before any sign-in work when wallet sessions aren't set up on this server. */
export function requireSessionSecret(): void {
  secret()
}

const mac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url")

function cookie(name: string, value: string, maxAge: number, httpOnly: boolean): string {
  const secure = serverEnv().NODE_ENV === "production" ? "; Secure" : ""
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${httpOnly ? "; HttpOnly" : ""}${secure}`
}

/** The two Set-Cookie values that start a wallet session for this user. */
export function startSession(userId: string): string[] {
  const maxAge = SESSION_DAYS * DAY_S
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + maxAge }),
  ).toString("base64url")
  return [
    cookie(SESSION_COOKIE, `${payload}.${mac(payload)}`, maxAge, true),
    cookie(WALLET_FLAG_COOKIE, "1", maxAge, false),
  ]
}

/** The Set-Cookie values that end it. */
export function endSession(): string[] {
  return [cookie(SESSION_COOKIE, "", 0, true), cookie(WALLET_FLAG_COOKIE, "", 0, false)]
}

/** The user id of a valid wallet session on this request, or null. Never throws for a bad or missing cookie. */
export function walletSessionUserId(request: Request): string | null {
  const raw = request.headers.get("cookie")?.match(/(?:^|;\s*)tegata-session=([^;]+)/)?.[1]
  if (!raw || !serverEnv().SESSION_SECRET) return null
  const [payload, signature] = raw.split(".")
  if (!payload || !signature) return null
  const expected = Buffer.from(mac(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid?: string
      exp?: number
    }
    if (!uid || !exp || exp * 1000 < Date.now()) return null
    return uid
  } catch {
    return null
  }
}
