import { createFromSource } from "fumadocs-core/search/server"

import { source } from "@/lib/source"

export const revalidate = false

/** The search index, built once at export and searched in the browser. */
export const { staticGET: GET } = createFromSource(source)
