import { notFound, route } from "@/lib/server/http.ts"
import { personPageView } from "@/lib/server/payroll.ts"

/** The person's page data (public by its token): their pay, where it lands, their payslips. */
export const GET = route(async (_request, context: { params: Promise<{ token: string }> }) => {
  const page = await personPageView((await context.params).token)
  if (!page) throw notFound("This page has closed")
  return { page }
})
