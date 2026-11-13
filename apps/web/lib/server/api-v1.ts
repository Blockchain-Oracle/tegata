// The public API's front door: the key from `Authorization: Bearer tk_…`, and the business and owner behind it.
import { authenticate } from "@tegata/services"

import { db } from "./context.ts"

export async function requireKey(request: Request) {
  const { key, workspace } = await authenticate(db(), request.headers.get("authorization"))
  return { key, workspace, network: key.network }
}
