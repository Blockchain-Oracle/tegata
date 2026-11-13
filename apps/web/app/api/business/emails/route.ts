import { OPTIONAL_EMAILS } from "@tegata/documents"
import { emailPrefs, ownerAddress, recentEmails, setEmailPref } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** Where the business's emails go, which ones it gets, and the last few sent. */
export const GET = route(async (request) => {
  const { workspace } = await requireOwner(request)
  const [to, prefs, recent] = await Promise.all([
    ownerAddress(db(), workspace.id),
    emailPrefs(db(), workspace.id),
    recentEmails(db(), workspace.id),
  ])
  return {
    to,
    options: OPTIONAL_EMAILS.map((o) => ({ ...o, on: prefs[o.kind] !== false })),
    recent: recent.map((e) => ({
      id: e.id,
      kind: e.kind,
      to: e.to,
      status: e.status,
      at: (e.sentAt ?? e.createdAt).toISOString(),
    })),
  }
})

const body = z.object({
  kind: z.enum(OPTIONAL_EMAILS.map((o) => o.kind) as [string, ...string[]]),
  on: z.boolean(),
})

/** Switch one optional email on or off. Security and money-out notices have no switch. */
export const PUT = route(async (request) => {
  const { workspace } = await requireOwner(request)
  const { kind, on } = body.parse(await request.json())
  await setEmailPref(db(), workspace.id, kind as (typeof OPTIONAL_EMAILS)[number]["kind"], on)
  return { ok: true }
})
