import { logoPath, updateBusiness } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"

/** Base64 of the largest logo allowed, with room for the data URL prefix. */
const LOGO_MAX_CHARS = 280_000

const body = z.object({
  name: z.string(),
  address: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  timezone: z.string(),
  /** A data URL to set, null to remove, absent to keep. */
  logo: z.string().max(LOGO_MAX_CHARS).nullable().optional(),
})

/** Update the business profile that every receipt and invoice header shows. */
export const PATCH = route(async (request) => {
  const { user } = await requireOwner(request)
  const workspace = await updateBusiness(db(), user.id, body.parse(await request.json()))
  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      timezone: workspace.timezone,
      address: workspace.address,
      taxId: workspace.taxId,
      email: workspace.email,
      logo: logoPath(workspace),
    },
  }
})
