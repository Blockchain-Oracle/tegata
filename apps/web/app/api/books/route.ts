import { requireOwner } from "@/lib/server/auth.ts"
import { booksView, parseMonth } from "@/lib/server/books.ts"
import { route } from "@/lib/server/http.ts"
import { requestNetwork } from "@/lib/server/mode.ts"

/** A month of every movement (in the business's time zone), with money in, money out and net. */
export const GET = route(async (request) => {
  const network = requestNetwork(request)
  const { user, workspace } = await requireOwner(request)
  const month = parseMonth(new URL(request.url).searchParams.get("month"), workspace.timezone)
  return booksView(user, workspace, month, network)
})
