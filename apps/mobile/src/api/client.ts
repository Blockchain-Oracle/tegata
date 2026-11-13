// Calls Tegata's API at tegata.xyz as the signed-in person, exactly as the web does: Privy's access token as a
// Bearer, and the mode the person chose as the `tegata-mode` cookie that apps/web/lib/server/mode.ts reads on every
// request. `credentials: "omit"` keeps the phone's own cookie jar from replacing that header.
import { API_URL } from "@/config"

export type Mode = "sandbox" | "live"

/** An error from our API, with the message meant for the person. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const session: { mode: Mode; token: () => Promise<string | null> } = {
  mode: "sandbox",
  token: async () => null,
}

export function setApiSession(next: Partial<typeof session>) {
  Object.assign(session, next)
}

export const currentMode = () => session.mode

const TIMEOUT_MS = 30_000

export async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const token = init.auth === false ? null : await session.token()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      credentials: "omit",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        cookie: `tegata-mode=${session.mode}`,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    })
  } catch {
    throw new ApiError(0, "offline", "No connection. Nothing was sent.")
  } finally {
    clearTimeout(timer)
  }
  const data = (await response.json().catch(() => null)) as {
    error?: { code: string; message: string }
  } | null
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error?.code ?? "unknown",
      data?.error?.message ?? "Something went wrong",
    )
  }
  return data as T
}

/** A public Tegata page (pay link, receipt) as a full URL. */
export const webUrl = (path: string) => `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
