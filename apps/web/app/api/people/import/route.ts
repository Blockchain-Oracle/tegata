import { parsePeopleCsv } from "@tegata/core/payroll"
import { emailConfigured } from "@tegata/env"
import { enqueue } from "@tegata/jobs"
import { importPeople } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

const MAX_CSV_BYTES = 200_000

const body = z.object({ csv: z.string().max(MAX_CSV_BYTES, "That file is too large") })

/** Import people from a CSV: every good row is added, every bad one comes back with what to fix. */
export const POST = route(async (request) => {
  const network = requestNetwork(request)
  const { workspace } = await requireOwner(request)
  const { csv } = body.parse(await request.json())
  const parsed = parsePeopleCsv(csv)
  const { added, problems } = await importPeople(db(), workspace.id, network, parsed.rows)
  if (emailConfigured()) {
    const queue = await boss()
    for (const person of added) {
      if (person.email)
        await enqueue(
          queue,
          "payrollEmail",
          { kind: "invite", id: person.id },
          `invite:${person.id}`,
        )
    }
  }
  return {
    added: added.length,
    problems: [...parsed.problems, ...problems].sort((a, b) => a.line - b.line),
  }
})
