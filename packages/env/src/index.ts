import { z } from "zod"

/**
 * The only place that reads `process.env`. Everything else receives typed config.
 * A blank value counts as unset, so an empty line in `.env` never passes validation by accident.
 */

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional())

/** Comma-separated `ed25519:…` secret keys. */
const keyList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
  )
  .refine(
    (keys) => keys.every((key) => key.startsWith("ed25519:")),
    "Keys must start with ed25519:",
  )

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  /** Public URL of the web app, used in emails and links. */
  APP_URL: z.string().url().default("http://localhost:3100"),

  /**
   * Operator keys. Only the worker holds them (it requires testnet at start); the web server never gets them.
   * Mainnet keys turn Live on in the worker.
   */
  OPERATOR_KEYS_TESTNET: optional(keyList),
  OPERATOR_KEYS_MAINNET: optional(keyList),
  /** Tells the web server Live is on, without giving it the mainnet keys. */
  LIVE_ENABLED: optional(z.enum(["true", "false"])),

  /** Resend (https://resend.com): invoice and reminder emails. Both unset: Tegata issues links only. */
  RESEND_API_KEY: optional(z.string()),
  /** A sender on a domain verified in Resend, e.g. `Tegata <invoices@tegata.xyz>`. */
  EMAIL_FROM: optional(z.string()),

  PRIVY_APP_ID: optional(z.string()),
  PRIVY_APP_SECRET: optional(z.string()),
  /** Signs the session cookie of people who sign in with a NEAR wallet. At least 32 characters. */
  SESSION_SECRET: optional(z.string().min(32)),
  /** From the Privy dashboard; lets the server verify tokens without a network call. */
  PRIVY_VERIFICATION_KEY: optional(z.string()),

  /** Optional 1Click partner key; without it 1Click adds its own small fee. */
  ONECLICK_API_KEY: optional(z.string()),
  /** Development only: let webhook endpoints be http://localhost (production always requires public https). */
  ALLOW_LOCAL_WEBHOOKS: optional(z.enum(["true", "false"])),
})

export type ServerEnv = z.infer<typeof serverSchema>

let cached: ServerEnv | undefined

/** Validated server environment. Throws once, at start, with every problem listed. */
export function serverEnv(): ServerEnv {
  if (cached) return cached
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")
    throw new Error(`Environment is not valid:\n${problems}`)
  }
  cached = parsed.data
  return cached
}

/** Load the repo-root `.env` when running outside Docker (scripts, the worker in dev). */
export function loadDotEnv(path: string): void {
  try {
    process.loadEnvFile(path)
  } catch {
    // Docker and CI pass variables directly.
  }
}

/** True when Live (mainnet) can be offered. */
export function liveEnabled(env: ServerEnv = serverEnv()): boolean {
  return env.LIVE_ENABLED === "true" || (env.OPERATOR_KEYS_MAINNET?.length ?? 0) > 0
}

/** Email goes out only when Resend and a verified sender are both set. */
export function emailConfigured(env: ServerEnv = serverEnv()): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM)
}

/** The operator keys for a network, for the worker and operator tools. Throws when they are missing. */
export function operatorKeys(
  network: "testnet" | "mainnet",
  env: ServerEnv = serverEnv(),
): string[] {
  const keys = network === "testnet" ? env.OPERATOR_KEYS_TESTNET : env.OPERATOR_KEYS_MAINNET
  if (!keys?.length) throw new Error(`OPERATOR_KEYS_${network.toUpperCase()} is not set`)
  return keys
}

/** Webhooks may go to http://localhost only outside production, and only when switched on. */
export function allowLocalWebhooks(env: ServerEnv = serverEnv()): boolean {
  return env.NODE_ENV !== "production" && env.ALLOW_LOCAL_WEBHOOKS === "true"
}
