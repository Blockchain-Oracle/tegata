import { PrivyClient } from "@privy-io/node"
import { base58 } from "@scure/base"
import { schema } from "@tegata/db"
import { serverEnv } from "@tegata/env"
import { eq } from "drizzle-orm"

import { db } from "./context.ts"
import { HttpError, unauthorized } from "./http.ts"

const NOT_CONFIGURED = 503
const ED25519_KEY_HEX_LENGTH = 64
const HEX = 16

let client: PrivyClient | undefined

export function privy(): PrivyClient {
  const env = serverEnv()
  if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET) {
    throw new HttpError(
      NOT_CONFIGURED,
      "signin_not_configured",
      "Sign-in is not set up on this server",
    )
  }
  client ??= new PrivyClient({
    appId: env.PRIVY_APP_ID,
    appSecret: env.PRIVY_APP_SECRET,
    ...(env.PRIVY_VERIFICATION_KEY ? { jwtVerificationKey: env.PRIVY_VERIFICATION_KEY } : {}),
  })
  return client
}

function bearer(request: Request): string | undefined {
  const header = request.headers.get("authorization")
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice("bearer ".length).trim()
  const cookie = request.headers.get("cookie")
  return cookie?.match(/(?:^|;\s*)privy-token=([^;]+)/)?.[1]
}

/** The Privy user id behind this request, or a 401. */
export async function privyUserId(request: Request): Promise<string> {
  const token = bearer(request)
  if (!token) throw unauthorized()
  try {
    const claims = await privy().utils().auth().verifyAccessToken(token)
    return claims.user_id
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw unauthorized()
  }
}

/** The signed-in user row, or a 401. */
export async function requireUser(request: Request) {
  const id = await privyUserId(request)
  const [user] = await db().select().from(schema.users).where(eq(schema.users.privyId, id))
  if (!user) throw unauthorized()
  return user
}

/** The business a user owns, if they have named one. */
export async function workspaceOf(userId: string) {
  const [workspace] = await db()
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.ownerId, userId))
  return workspace
}

/** The signed-in user and their business, or a 401 / 404. */
export async function requireOwner(request: Request) {
  const user = await requireUser(request)
  const workspace = await workspaceOf(user.id)
  if (!workspace) throw new HttpError(404, "no_business", "Name your business first")
  return { user, workspace }
}

/** A Privy NEAR wallet address is the 32-byte ed25519 public key in hex. */
export function publicKeyFromNearAddress(address: string): string | null {
  if (!new RegExp(`^[0-9a-f]{${ED25519_KEY_HEX_LENGTH}}$`, "i").test(address)) return null
  const bytes = Uint8Array.from(address.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, HEX))
  return `ed25519:${base58.encode(bytes)}`
}
