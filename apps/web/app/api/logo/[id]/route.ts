import { businessLogo } from "@tegata/services"
import { z } from "zod"

import { db } from "@/lib/server/context.ts"

/** A day; the URL carries a version, so a new logo is a new URL. */
const CACHE_SECONDS = 86_400

/** A business's logo, public like its pay page. Only PNG, JPEG or WebP is ever stored. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await context.params).id)
  if (!id.success) return new Response("Not found", { status: 404 })
  const logo = await businessLogo(db(), id.data)
  if (!logo) return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "content-type": logo.type,
      "cache-control": `public, max-age=${CACHE_SECONDS}, immutable`,
      "x-content-type-options": "nosniff",
    },
  })
}
