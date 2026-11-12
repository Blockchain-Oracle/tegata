import { getPerson, removePerson, updatePerson } from "@tegata/services"
import { z } from "zod"

import { requireOwner } from "@/lib/server/auth.ts"
import { db } from "@/lib/server/context.ts"
import { notFound, route } from "@/lib/server/http.ts"
import { personBody, personInput, teamPersonView } from "@/lib/server/payroll.ts"

type Context = { params: Promise<{ id: string }> }

/** One person: where their pay lands and their payslips. */
export const GET = route(async (request, context: Context) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  const { member, slips } = await getPerson(db(), workspace.id, id)
  if (!member) throw notFound("No such person")
  return {
    person: teamPersonView(member),
    slips: slips.map(({ row, run }) => ({
      id: row.id,
      amount: row.amount.toString(),
      label: `${run.periodFrom} – ${run.periodTo}`,
      paidAt: row.paidAt?.toISOString() ?? null,
    })),
  }
})

export const PATCH = route(async (request, context: Context) => {
  const { workspace } = await requireOwner(request)
  const id = z.uuid().parse((await context.params).id)
  await updatePerson(db(), workspace.id, id, personInput(personBody.parse(await request.json())))
  return { ok: true }
})

/** Remove someone from the team. Their payslips stay. */
export const DELETE = route(async (request, context: Context) => {
  const { workspace } = await requireOwner(request)
  await removePerson(db(), workspace.id, z.uuid().parse((await context.params).id))
  return { ok: true }
})
