import { getAccessToken } from "@privy-io/react-auth"

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

/** Call our API as the signed-in person. */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  })
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

/** Download a file from our API as the signed-in person (a CSV or a PDF), saved under the name the server gives. */
export async function download(path: string): Promise<void> {
  const token = await getAccessToken()
  const response = await fetch(path, { headers: token ? { authorization: `Bearer ${token}` } : {} })
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: { message: string } } | null
    throw new ApiError(
      response.status,
      "download",
      data?.error?.message ?? "Couldn't make the file",
    )
  }
  const name =
    /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "tegata"
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
