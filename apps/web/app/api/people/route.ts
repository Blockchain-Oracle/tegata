import { emailConfigured } from "@tegata/env"
import { enqueue } from "@tegata/jobs"
import { addPerson, listPeople } from "@tegata/services"

import { requireOwner } from "@/lib/server/auth.ts"
import { boss, db } from "@/lib/server/context.ts"
import { route } from "@/lib/server/http.ts"
import { PAYROLL_NETWORK, personBody, personInput, teamPersonView } from "@/lib/server/payroll.ts"

/** The team on this network, with where each person's pay lands. */
export const GET = route(async (request) => {
  const { workspace } = await requireOwner(request)
  const team = await listPeople(db(), workspace.id, PAYROLL_NETWORK)
  return { people: team.map(teamPersonView), emailEnabled: emailConfigured() }
})

/** Add a person. With email on, they get the invite; otherwise the owner shares their page. */
export const POST = route(async (request) => {
  const { workspace } = await requireOwner(request)
  const person = await addPerson(
    db(),
    workspace.id,
    PAYROLL_NETWORK,
    personInput(personBody.parse(await request.json())),
  )
  const emailed = emailConfigured() && Boolean(person.email)
  if (emailed)
    await enqueue(
      await boss(),
      "payrollEmail",
      { kind: "invite", id: person.id },
      `invite:${person.id}`,
    )
  return { id: person.id, token: person.token, emailed }
})
